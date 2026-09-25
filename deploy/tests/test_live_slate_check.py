from deploy.oci.live_slate_check import live_game_ids, read_cpu_busy_seconds, summarize


def test_summarize_pass_and_fail():
    ok = summarize(
        codes={200: 900},
        latencies=[0.1] * 900,
        rounds=[0.2] * 60,
        cpu_seconds=20,
        wall_seconds=90,
        cores=4,
    )
    assert ok["pass"] and ok["cpu_pct"] < 15
    bad = summarize(
        codes={200: 890, 403: 10},
        latencies=[0.1] * 900,
        rounds=[1.2] + [0.2] * 59,
        cpu_seconds=20,
        wall_seconds=90,
        cores=4,
    )
    assert (
        not bad["pass"] and "non-200" in bad["reasons"] and "round>1s" in bad["reasons"]
    )


def test_summarize_cpu_and_empty_run_fail():
    hot = summarize(
        codes={200: 10},
        latencies=[0.1] * 10,
        rounds=[0.2] * 10,
        cpu_seconds=60,
        wall_seconds=90,
        cores=4,
    )
    assert not hot["pass"] and hot["reasons"] == ["cpu>=15%"]
    empty = summarize(
        codes={}, latencies=[], rounds=[], cpu_seconds=0, wall_seconds=90, cores=4
    )
    assert not empty["pass"] and "no-requests" in empty["reasons"]


def test_transport_failures_count_as_non_200():
    res = summarize(
        codes={200: 5, 0: 1},
        latencies=[0.1] * 6,
        rounds=[0.2] * 6,
        cpu_seconds=1,
        wall_seconds=90,
        cores=4,
        via_ingestion=True,
    )
    assert res["non_200"] == 1 and res["mode"] == "via-ingestion" and not res["pass"]


def test_live_game_ids_filters_in_progress():
    sb = {
        "events": [
            {"id": 1, "status": {"type": {"state": "in"}}},
            {"id": 2, "status": {"type": {"state": "post"}}},
            {"id": 3, "status": {"type": {"state": "pre"}}},
        ]
    }
    assert live_game_ids(sb) == ["1"]
    assert live_game_ids(sb, include_all=True) == ["1", "2", "3"]
    assert live_game_ids({}) == []


def test_read_cpu_busy_seconds_excludes_idle_and_iowait(tmp_path, monkeypatch):
    stat = tmp_path / "stat"
    # user nice system idle iowait irq softirq steal
    stat.write_text("cpu  100 0 50 1000 25 5 5 0 0 0\ncpu0 1 1 1 1 1 1 1 1 0 0\n")
    monkeypatch.setattr("os.sysconf", lambda name: 100)
    assert read_cpu_busy_seconds(str(stat)) == 1.6


def test_units_cpu_pct_is_share_of_box_and_tolerates_missing():
    from deploy.oci.live_slate_check import units_cpu_pct

    before = {
        "lunara-api": 1_000_000_000,
        "lunara-ingestion": None,
        "cephalon-lumen": 5,
    }
    after = {"lunara-api": 10_000_000_000, "lunara-ingestion": 7, "cephalon-lumen": 1}
    pct = units_cpu_pct(before, after, wall_seconds=90, cores=4)
    assert pct == {"lunara-api": 2.5, "lunara-ingestion": None, "cephalon-lumen": None}


def test_read_units_cpu_nsec_maps_not_set_and_errors(monkeypatch):
    import subprocess

    from deploy.oci import live_slate_check as m

    outs = iter(["123\n", "18446744073709551615\n", "[not set]\n"])

    def fake_run(*a, **k):
        return subprocess.CompletedProcess(a, 0, stdout=next(outs), stderr="")

    monkeypatch.setattr(m.subprocess, "run", fake_run)
    assert m.read_units_cpu_nsec(("a", "b", "c")) == {"a": 123, "b": None, "c": None}
