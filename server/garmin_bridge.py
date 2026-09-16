"""Private JSON-lines bridge. Credentials only arrive on stdin, never argv/logs."""
import json
import os
import sys
import logging
import tempfile
from pathlib import Path
from garminconnect import Garmin, GarminConnectAuthenticationError, GarminConnectTooManyRequestsError

logging.disable(logging.CRITICAL)
os.umask(0o077)

def emit(value):
    print(json.dumps(value, allow_nan=False), flush=True)

def mfa():
    emit({"event": "mfa"})
    return json.loads(sys.stdin.readline())["code"]

def main():
    request = json.loads(sys.stdin.readline())
    tokenstore = str(Path(sys.argv[1]) / "garmin")
    Path(tokenstore).mkdir(mode=0o700, parents=True, exist_ok=True)
    client = Garmin(request.get("email"), request.get("password"), prompt_mfa=mfa, retry_attempts=1)
    if request["command"] == "login":
        # Validate the supplied account, not a previously cached session. Keep the
        # old working token until the new login and MFA have both succeeded.
        with tempfile.TemporaryDirectory(prefix="garmin-login-", dir=sys.argv[1]) as pending:
            client.login(pending)
            source = Path(pending) / "garmin_tokens.json"
            if not source.exists():
                client.client.dump(pending)
            os.replace(source, Path(tokenstore) / "garmin_tokens.json")
    else:
        client.login(tokenstore)
    request.pop("password", None)
    command = request["command"]
    if command == "login":
        emit({"result": {"connected": True}})
    elif command == "activities":
        emit({"result": client.get_activities_by_date(request["oldest"], request["newest"], "running")})
    elif command == "detail":
        activity_id = request["id"]
        result = {"summary": client.get_activity(activity_id), "errors": {}}
        endpoints = {
            "details": lambda: client.get_activity_details(activity_id, maxchart=20000, maxpoly=20000),
            "laps": lambda: client.get_activity_splits(activity_id),
            "typedSplits": lambda: client.get_activity_typed_splits(activity_id),
            "splitSummaries": lambda: client.get_activity_split_summaries(activity_id),
            "hrZones": lambda: client.get_activity_hr_in_timezones(activity_id),
            "powerZones": lambda: client.get_activity_power_in_timezones(activity_id),
            "weather": lambda: client.get_activity_weather(activity_id),
        }
        for name, fetch in endpoints.items():
            try:
                result[name] = fetch()
            except (GarminConnectAuthenticationError, GarminConnectTooManyRequestsError):
                raise
            except Exception:
                result["errors"][name] = "Garmin에서 이 데이터를 제공하지 않거나 요청에 실패했습니다."
        emit({"result": result})
    else:
        raise ValueError("Unknown command")

try:
    main()
except GarminConnectAuthenticationError:
    emit({"error": "Garmin 인증에 실패했습니다. 계정과 인증 코드를 확인하고 다시 연결하세요."})
except GarminConnectTooManyRequestsError:
    emit({"error": "Garmin 요청 한도에 도달했습니다. 잠시 후 다시 시도하세요."})
except Exception:
    emit({"error": "Garmin 요청을 완료하지 못했습니다. 연결 상태를 확인하고 다시 시도하세요."})
