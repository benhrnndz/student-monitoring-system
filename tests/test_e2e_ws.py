import sys
import json
sys.path.append("backend")

from starlette.testclient import TestClient
from app.main import app

def test_teacher_student_reflection():
    client = TestClient(app)

    # 1. Check active session endpoint
    res = client.get("/api/sessions/active")
    assert res.status_code == 200, f"Failed: {res.text}"
    session_data = res.json()
    session_id = session_data["id"]
    print(f"[TEST 1] Active session resolved: {session_id}")

    # 2. Connect teacher websocket
    with client.websocket_connect(f"/ws/session/{session_id}?role=teacher&user_name=Prof.%20Sarah") as teacher_ws:
        initial_sync = teacher_ws.receive_json()
        assert initial_sync["event"] == "teacher:roster_sync"
        print(f"[TEST 2] Teacher connected. Initial roster: {len(initial_sync['payload']['students'])} students")

        # 3. Connect student websocket
        with client.websocket_connect(
            f"/ws/session/{session_id}?role=student&user_id=alex-test-uuid&user_name=Alex%20Chen"
        ) as student_ws:
            print(f"[TEST 3] Student Alex Chen connected.")

            # 4. Teacher should receive student_updated event reflecting Alex Chen!
            update_msg = teacher_ws.receive_json()
            assert update_msg["event"] == "teacher:student_updated", f"Unexpected event: {update_msg}"
            student_payload = update_msg["payload"]
            assert student_payload["name"] == "Alex Chen", f"Wrong student name: {student_payload}"
            assert student_payload["currentStatus"] == "ACTIVE", f"Wrong status: {student_payload}"
            print(f"[TEST 4] SUCCESS! Teacher received real-time student reflection: {student_payload['name']} is {student_payload['currentStatus']}")

            # 5. Student sends tab away event
            student_ws.send_json({
                "event": "telemetry:status_change",
                "sessionId": session_id,
                "timestamp": 123456789,
                "payload": {
                    "studentId": "alex-test-uuid",
                    "previousStatus": "ACTIVE",
                    "newStatus": "TAB_AWAY",
                    "reason": "Tab hidden > 5s",
                    "gracePeriodSeconds": 5
                }
            })

            # 6. Teacher should receive TAB_AWAY update!
            tab_away_msg = teacher_ws.receive_json()
            assert tab_away_msg["event"] == "teacher:student_updated"
            assert tab_away_msg["payload"]["currentStatus"] == "TAB_AWAY"
            print(f"[TEST 5] SUCCESS! Teacher received tab away update: {tab_away_msg['payload']['currentStatus']}")

            # 7. Student sends camera toggle event
            student_ws.send_json({
                "event": "telemetry:camera_toggle",
                "sessionId": session_id,
                "timestamp": 123456790,
                "payload": {
                    "studentId": "alex-test-uuid",
                    "cameraOn": True
                }
            })

            cam_msg = teacher_ws.receive_json()
            assert cam_msg["event"] == "teacher:student_updated"
            assert cam_msg["payload"]["cameraOn"] is True
            print(f"[TEST 6] SUCCESS! Teacher received camera ON update: {cam_msg['payload']['cameraOn']}")

        # 8. Student disconnected, teacher should receive disconnected status
        disconnect_msg = teacher_ws.receive_json()
        assert disconnect_msg["payload"]["currentStatus"] == "DISCONNECTED"
        print(f"[TEST 7] SUCCESS! Teacher received student disconnect reflection.")

    print("\n>>> ALL TESTS PASSED! Student-to-Teacher real-time reflection verified 100%!")

if __name__ == "__main__":
    test_teacher_student_reflection()
