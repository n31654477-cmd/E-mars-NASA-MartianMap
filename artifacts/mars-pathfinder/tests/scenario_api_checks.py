"""Run against the managed preview API; no third-party Python packages needed."""
import json
import math
import os
import urllib.error
import urllib.request

BASE = os.environ.get("MARS_TEST_BASE_URL", "http://localhost:80/mars-pathfinder/api/mars")
checks = 0


def check(condition, message):
    global checks
    assert condition, message
    checks += 1


def post(path, body, status=200):
    request = urllib.request.Request(
        BASE + path, json.dumps(body).encode(), {"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            check(response.status == status, f"Status {path}")
            return json.load(response)
    except urllib.error.HTTPError as error:
        check(error.code == status, f"{path}: {error.code}, {error.read()[:300]}")


def positions(route):
    return [(c["row"], c["col"]) for c in route["path"]]


def close(a, b):
    return math.isclose(a, b, rel_tol=1e-10, abs_tol=1e-10)

def distance(path):
    total = 0
    for a, b in zip(path, path[1:]):
        lat_a, lat_b = math.radians(a["centerLat"]), math.radians(b["centerLat"])
        dl = math.radians(b["centerLng"] - a["centerLng"])
        hav = math.sin((lat_b-lat_a)/2)**2 + math.cos(lat_a)*math.cos(lat_b)*math.sin(dl/2)**2
        total += 2*3396.190*math.asin(math.sqrt(max(0, min(1, hav))))
    return total


bounds = dict(startLat=-10, endLat=10, startLng=-20, endLng=20, rows=10, columns=10)
for algorithm in ("bfs", "dijkstra", "astar"):
    route = dict(algorithm=algorithm, startLat=-5, startLng=-10, endLat=5, endLng=10, grid=bounds)
    baseline = post("/route", route)
    first = post("/event", dict(route=route, seed=42))
    check(positions(baseline) == positions(first["oldRoute"]), "Old path is pre-event path")
    check(close(baseline["totalCost"], first["oldRoute"]["totalCost"]), "Old cost is pre-event cost")
    event = first["event"]
    spec = event["spec"]
    check((spec["row"], spec["col"]) in positions(baseline)[1:], "Origin is on entered path")
    check(spec["factor"] in ("terrain", "structure"), "Only scenario factors change")
    check(0 < spec["delta"] <= .25, "Bounded origin increment")
    changes = event["changes"]
    origin = next(c for c in changes if c["origin"])
    check(len(changes) <= 9, "At most eight residual neighbors")
    weight = 45 if spec["factor"] == "terrain" else 35
    check(close(origin["deltaDf"], weight * spec["delta"] / 100), "Origin DF increment")
    for change in changes:
        check(abs(change["row"] - spec["row"]) <= 1 and abs(change["col"] - spec["col"]) <= 1,
              "Only immediate ring changes")
        check(0 <= change["factorBefore"] < change["factorAfter"] <= 1, "Factor increases with cap")
        check(close(change["deltaDf"], change["dfAfter"] - change["dfBefore"]), "DF trace is accurate")
        check(change["areaKm2"] > 0, "Positive Mars-sphere area")
        if not change["origin"]:
            dr, dc = change["row"] - spec["row"], change["col"] - spec["col"]
            residual = min(1 - change["factorBefore"],
                           spec["delta"] * .5 / (1 + change["areaKm2"] / 10000) / math.hypot(dr, dc))
            check(close(change["deltaDf"], weight * residual / 100), "Exact area residual equation")
            check(0 < change["deltaDf"] < origin["deltaDf"], "Residual added danger is smaller")
    cells = {(c["row"], c["col"]): c for c in first["grid"]["cells"]}
    old_path_updated_cost = sum(cells[p]["df"] for p in positions(baseline)[1:])
    check(first["newRoute"]["totalCost"] <= old_path_updated_cost + 1e-10,
          "Reroute no more costly than old path on same scenario")
    for cell in first["grid"]["cells"]:
        assessment = cell["assessment"]
        check(close(cell["df"], 1 + sum(f["contribution"] for f in assessment["factors"]) / 100),
              "All cells follow exact weighted model")
        check(cell["blocked"] is None, "Physical traversability remains unknown")
        check(len(assessment["unknowns"]) >= 7, "Missing measurements remain missing")
    same_seed = post("/event", dict(route=route, seed=42))
    check(first == same_seed, "Seed reproduces complete event and reroute")
    second = post("/event", dict(route={**route, "events": first["events"]}, seed=91))
    check(len(second["events"]) == 2, "Cumulative event history")
    check(positions(second["oldRoute"]) == positions(first["newRoute"]), "Repeated event uses current route")
    check(close(second["oldRoute"]["totalCost"], first["newRoute"]["totalCost"]), "Cumulative costs replay")
    replay = post("/route", {**route, "events": second["events"]})
    check(replay == second["newRoute"], "Route endpoint replays scenario costs exactly")

    # Traveler is chosen BEFORE hazard generation on the visible current route.
    index = len(baseline["path"]) // 2
    traveler = baseline["path"][index]
    moved = post("/event", dict(route=route, seed=42, travelerPathIndex=index))
    remaining = positions(baseline)[index:]
    check(positions(moved["oldRoute"]) == remaining, "Pre-event comparison keeps exact remaining suffix")
    check(positions(moved["newRoute"])[0] == remaining[0], "New route starts at traveler")
    check(positions(moved["newRoute"])[-1] == remaining[-1], "Destination B unchanged")
    check(close(moved["oldRoute"]["totalCost"], sum(c["df"] for c in baseline["path"][index+1:])),
          "Remaining comparison excludes traveled cells and starting traveler")
    check(close(moved["oldRoute"]["avgSafetyScore"],
                sum(c["safetyScore"] for c in baseline["path"][index:]) / len(remaining)),
          "Remaining safety average reflects only suffix")
    moved_spec = moved["event"]["spec"]
    check((moved_spec["row"], moved_spec["col"]) in remaining[1:],
          "Event origin is ahead of traveler on remaining route")
    check(close(moved["oldRoute"]["distanceKm"], distance(baseline["path"][index:])),
          "Remaining distance matches exact remaining model path")
    continued_input = {**route, "startLat": traveler["centerLat"], "startLng": traveler["centerLng"],
                       "events": moved["events"]}
    continued = post("/event", dict(route=continued_input, seed=91))
    check(positions(continued["oldRoute"]) == positions(moved["newRoute"]),
          "Consecutive event keeps moved origin without teleporting to A")
    check(continued["newRoute"]["path"][0]["row"] == traveler["row"] and
          continued["newRoute"]["path"][0]["col"] == traveler["col"], "Continued route still starts at traveler")
    next_index = min(1, len(continued["newRoute"]["path"]) - 2)
    advanced = post("/event", dict(route={**continued_input, "events": continued["events"]},
                                  seed=3, travelerPathIndex=next_index))
    check(positions(advanced["oldRoute"]) == positions(continued["newRoute"])[next_index:],
          "Can advance traveler again before next event")
    unchanged = post("/event", dict(route=route, seed=42, travelerPathIndex=0))
    check(positions(unchanged["newRoute"]) == positions(first["newRoute"]) and
          unchanged["event"] == first["event"], "Selecting first cell preserves random scenario")
    for invalid_index in (-1, len(baseline["path"]) - 1, 99999, 1.5):
        post("/event", dict(route=route, travelerPathIndex=invalid_index), 400)

post("/event", {"route": None}, 400)
post("/event", {"route": {**route, "algorithm": "invalid"}}, 400)
post("/event", {"route": {**route, "endLat": 90}}, 400)
post("/event", {"route": {**route, "endLat": -5, "endLng": -10}}, 400)
post("/event", {"route": {**route, "events": [{"row": 0, "col": 0, "factor": "terrain", "delta": .1}] * 50}}, 400)
post("/event", {"route": {**route, "events": [{"row": 0, "col": 0, "factor": "uncertainty", "delta": .1}]}}, 400)
print(f"PASS: {checks} live API scenario, reroute, replay and validation checks")
