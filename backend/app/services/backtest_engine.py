"""Pure, deterministic backtest simulator. Source of truth = (candles, actions, upto_time).
Positions / equity / realized are ALWAYS derived, never stored, so resume can't drift."""
from __future__ import annotations

import math

MINUTE = 60


def _round(v: float, n: int = 4) -> float:
    return round(v, n)


def _dir_of(side: str) -> int:
    return 1 if side == "buy" else -1


def simulate(candles: list[dict], actions: list[dict], upto_time: int, start_balance: float) -> dict:
    """Replay every candle with time <= upto_time, applying actions at their at_time."""
    acts = sorted(actions, key=lambda a: a["at_time"])
    ai = 0
    balance = float(start_balance)
    pending: dict[str, dict] = {}     # limit orders awaiting fill, keyed by action id
    open_pos: dict[str, dict] = {}    # live positions, keyed by originating action id
    realized: list[dict] = []
    events: list[dict] = []
    equity: list[dict] = []

    def book(pid: str, exit_price: float, t: int, reason: str):
        nonlocal balance
        p = open_pos.pop(pid, None)
        if not p:
            return
        d = _dir_of(p["side"])
        pnl = _round((exit_price - p["entry"]) * p["qty"] * d, 2)
        balance = _round(balance + pnl, 2)
        rec = {
            "id": pid, "side": p["side"], "qty": p["qty"], "entry": p["entry"], "exit": exit_price,
            "entryTime": p["entryTime"], "exitTime": t, "pnl": pnl, "reason": reason,
            "tp": p.get("tp"), "sl": p.get("sl"),
        }
        realized.append(rec)
        events.append({"time": t, "type": reason, "label": f"{reason.upper()} filled · {pnl:+.2f}", "pnl": pnl})

    for c in candles:
        t = c["time"]
        if t > upto_time:
            break
        # 1) apply actions that fall at/before this candle
        while ai < len(acts) and acts[ai]["at_time"] <= t:
            a = acts[ai]; ai += 1
            kind = a["kind"]; pl = a.get("payload") or {}; aid = a["id"]
            if kind == "order":
                side = pl.get("side", "buy"); otype = pl.get("type", "market")
                qty = float(pl.get("qty") or 0)
                tp = pl.get("tp"); sl = pl.get("sl")
                tp = float(tp) if tp not in (None, "", 0) else None
                sl = float(sl) if sl not in (None, "", 0) else None
                if otype == "limit":
                    lp = float(pl.get("limit_price") or 0)
                    pending[aid] = {"id": aid, "side": side, "qty": qty, "limit": lp, "tp": tp, "sl": sl}
                    events.append({"time": t, "type": "placed", "label": f"LIMIT {side.upper()} {qty} @ {lp}", "pnl": 0})
                else:
                    entry = c["close"]
                    open_pos[aid] = {"id": aid, "side": side, "qty": qty, "entry": entry, "entryTime": t, "tp": tp, "sl": sl}
                    events.append({"time": t, "type": "filled", "label": f"MARKET {side.upper()} {qty} @ {entry}", "pnl": 0})
            elif kind == "cancel":
                tid = pl.get("targetId")
                if tid in pending:
                    pending.pop(tid)
                    events.append({"time": t, "type": "cancelled", "label": "Order cancelled", "pnl": 0})
            elif kind == "close":
                tid = pl.get("targetId")
                if tid in open_pos:
                    book(tid, c["close"], t, "closed")
            elif kind == "modify":
                tid = pl.get("targetId")
                tgt = open_pos.get(tid) or pending.get(tid)
                if tgt:
                    if pl.get("tp") is not None: tgt["tp"] = float(pl["tp"]) or None
                    if pl.get("sl") is not None: tgt["sl"] = float(pl["sl"]) or None
        # 2) fill pending limit orders on this candle's range
        for pid in list(pending.keys()):
            o = pending[pid]
            d = _dir_of(o["side"])
            hit = (o["side"] == "buy" and c["low"] <= o["limit"]) or (o["side"] == "sell" and c["high"] >= o["limit"])
            if hit:
                fill = o["limit"]
                open_pos[pid] = {"id": pid, "side": o["side"], "qty": o["qty"], "entry": fill, "entryTime": t, "tp": o["tp"], "sl": o["sl"]}
                pending.pop(pid)
                events.append({"time": t, "type": "filled", "label": f"LIMIT {o['side'].upper()} filled @ {fill}", "pnl": 0})
        # 3) check TP/SL on open positions (SL priority if both inside the candle)
        for pid in list(open_pos.keys()):
            p = open_pos[pid]; d = _dir_of(p["side"])
            sl_hit = p["sl"] is not None and ((d == 1 and c["low"] <= p["sl"]) or (d == -1 and c["high"] >= p["sl"]))
            tp_hit = p["tp"] is not None and ((d == 1 and c["high"] >= p["tp"]) or (d == -1 and c["low"] <= p["tp"]))
            if sl_hit:
                book(pid, p["sl"], t, "stop_loss")
            elif tp_hit:
                book(pid, p["tp"], t, "take_profit")
        # 4) mark-to-market equity at close
        upnl = 0.0
        for p in open_pos.values():
            d = _dir_of(p["side"])
            upnl += (c["close"] - p["entry"]) * p["qty"] * d
        equity.append({"time": t, "value": _round(balance + upnl, 2)})

    # advance any actions whose at_time is beyond the last candle but <= upto_time (edge)
    while ai < len(acts) and acts[ai]["at_time"] <= upto_time:
        ai += 1  # nothing to fill past data end; skip

    return {
        "balance": _round(balance, 2),
        "open": list(open_pos.values()),
        "pending": list(pending.values()),
        "realized": realized,
        "events": events,
        "equity": equity,
    }


def session_stats(candles: list[dict], actions: list[dict], start_balance: float) -> dict:
    """Full-run derivation used for the session cards (win%, realized, drawdown, current balance)."""
    if not candles:
        return {"currentBalance": start_balance, "realizedPnl": 0.0, "winRate": 0.0,
                "tradeCount": 0, "drawdown": 0.0, "completionPct": 0.0}
    end = candles[-1]["time"]
    st = simulate(candles, actions, end, start_balance)
    wins = [r for r in st["realized"] if r["pnl"] > 0]
    losses = [r for r in st["realized"] if r["pnl"] < 0]
    n = len(st["realized"])
    peak = -math.inf; dd = 0.0
    for e in st["equity"]:
        peak = max(peak, e["value"]); dd = max(dd, peak - e["value"])
    return {
        "currentBalance": st["balance"],
        "realizedPnl": _round(sum(r["pnl"] for r in st["realized"]), 2),
        "winRate": _round(len(wins) / n * 100, 2) if n else 0.0,
        "tradeCount": n,
        "drawdown": _round(dd, 2),
        "completionPct": 100.0,
    }