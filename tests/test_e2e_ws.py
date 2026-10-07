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

    print("\n>>> TEST SUITE 1 PASSED! Student-to-Teacher real-time reflection verified!")

def test_batch_nudge_and_engagement_calculation():
    import time
    client = TestClient(app)

    res = client.get("/api/sessions/active")
    session_id = res.json()["id"]

    with client.websocket_connect(f"/ws/session/{session_id}?role=teacher&user_name=Prof.%20Sarah") as teacher_ws:
        teacher_ws.receive_json() # roster sync

        # Connect Active Sam
        with client.websocket_connect(f"/ws/session/{session_id}?role=student&user_id=active-sam&user_name=Active%20Sam") as sam_ws:
            teacher_ws.receive_json() # Sam join

            # Connect Distracted Dan
            with client.websocket_connect(f"/ws/session/{session_id}?role=student&user_id=dan-uuid&user_name=Distracted%20Dan") as dan_ws:
                teacher_ws.receive_json() # Dan join

                # Dan switches tab
                dan_ws.send_json({
                    "event": "telemetry:status_change",
                    "sessionId": session_id,
                    "timestamp": int(time.time()),
                    "payload": {
                        "studentId": "dan-uuid",
                        "previousStatus": "ACTIVE",
                        "newStatus": "TAB_AWAY",
                        "reason": "Tab hidden",
                        "gracePeriodSeconds": 5
                    }
                })
                teacher_ws.receive_json() # Dan TAB_AWAY reflection

                # Issue 3 Verification: Teacher sends teacher:nudge_all
                teacher_ws.send_json({
                    "event": "teacher:nudge_all",
                    "payload": { "message": "Class alert: please refocus!" }
                })

                # Teacher receives nudge_all_ack with nudgedCount == 1 (only Dan was inattentive)
                ack = teacher_ws.receive_json()
                assert ack["event"] == "teacher:nudge_all_ack", f"Expected nudge_all_ack, got {ack}"
                assert ack["payload"]["nudgedCount"] == 1, f"Expected 1 nudged student, got {ack['payload']['nudgedCount']}"
                print(f"[TEST BATCH NUDGE] SUCCESS! Teacher batch nudged {ack['payload']['nudgedCount']} inattentive student(s)")

                # Dan receives student:nudge
                dan_nudge = dan_ws.receive_json()
                assert dan_nudge["event"] == "student:nudge"
                assert dan_nudge["payload"]["message"] == "Class alert: please refocus!"
                print(f"[TEST BATCH NUDGE] SUCCESS! Inattentive student received nudge: {dan_nudge['payload']['message']}")

                # Let 1 second pass in TAB_AWAY to verify exact elapsed accumulation (Issue 2)
                time.sleep(1.1)

            # Dan disconnected
            teacher_ws.receive_json()

    # Query report to verify Issue 1 (Engagement Score < 100%) and Issue 2 (Accurate idle/away duration, not 300s+)
    report_res = client.get(f"/api/sessions/{session_id}/report")
    assert report_res.status_code == 200
    report_data = report_res.json()
    dan_report = next((s for s in report_data["attendances"] if s["studentId"] == "dan-uuid"), None)
    assert dan_report is not None, "Dan report not found"

    print(f"[REPORT METRICS] Dan tab away seconds: {dan_report['totalTabAwaySeconds']}s (Must NOT be 300s+)")
    assert 1 <= dan_report["totalTabAwaySeconds"] <= 20, f"Tab away seconds not tracked accurately: {dan_report['totalTabAwaySeconds']}"
    assert dan_report["engagementScore"] < 100.0, f"Engagement score did not drop: {dan_report['engagementScore']}"
    print(f"[TEST METRICS] SUCCESS! Engagement score dropped to {dan_report['engagementScore']}% and away time tracked accurately.")

def test_google_meet_telemetry_flow():
    import time
    client = TestClient(app)

    res = client.get("/api/sessions/active")
    session_id = res.json()["id"]

    with client.websocket_connect(f"/ws/session/{session_id}?role=teacher&user_name=Prof.%20Sarah") as teacher_ws:
        teacher_ws.receive_json() # Roster sync

        # Connect Google Meet student
        with client.websocket_connect(
            f"/ws/session/{session_id}?role=student&user_id=meet-student-1&user_name=Meet%20Attendee"
        ) as meet_ws:
            teacher_ws.receive_json() # Join reflection

            # 1. Google Meet camera toggle
            meet_ws.send_json({
                "event": "telemetry:camera_toggle",
                "sessionId": session_id,
                "timestamp": int(time.time()),
                "payload": {
                    "studentId": "meet-student-1",
                    "cameraOn": True,
                    "source": "GOOGLE_MEET"
                }
            })
            cam_msg = teacher_ws.receive_json()
            assert cam_msg["payload"]["cameraOn"] is True
            print("[TEST MEET] SUCCESS! Google Meet camera state reflected to Teacher Dashboard: ON")

            # 2. Student switches away from Google Meet tab to YouTube
            meet_ws.send_json({
                "event": "telemetry:status_change",
                "sessionId": session_id,
                "timestamp": int(time.time()),
                "payload": {
                    "studentId": "meet-student-1",
                    "previousStatus": "ACTIVE",
                    "newStatus": "TAB_AWAY",
                    "reason": "Switched away from Google Meet call > 5s",
                    "source": "GOOGLE_MEET"
                }
            })
            away_msg = teacher_ws.receive_json()
            assert away_msg["payload"]["currentStatus"] == "TAB_AWAY"
            print("[TEST MEET] SUCCESS! Google Meet tab switch reflected: TAB_AWAY")

            # 3. Teacher sends individual nudge to the Google Meet student
            teacher_ws.send_json({
                "event": "teacher:nudge",
                "payload": {
                    "studentId": "meet-student-1",
                    "message": "Please refocus on the presentation in Google Meet!"
                }
            })

            nudge_msg = meet_ws.receive_json()
            assert nudge_msg["event"] == "student:nudge"
            assert "Google Meet" in nudge_msg["payload"]["message"]
            print(f"[TEST MEET] SUCCESS! Google Meet client received focus nudge: {nudge_msg['payload']['message']}")

            # 4. Student clicks 'I am Listening' on Google Meet in-meeting HUD
            meet_ws.send_json({
                "event": "telemetry:status_change",
                "sessionId": session_id,
                "timestamp": int(time.time()),
                "payload": {
                    "studentId": "meet-student-1",
                    "previousStatus": "TAB_AWAY",
                    "newStatus": "ACTIVE",
                    "reason": "Acknowledged instructor nudge in Google Meet",
                    "source": "GOOGLE_MEET"
                }
            })
            active_msg = teacher_ws.receive_json()
            assert active_msg["payload"]["currentStatus"] == "ACTIVE"
            print("[TEST MEET] SUCCESS! In-meeting acknowledgement restored status to ACTIVE!")

if __name__ == "__main__":
    test_teacher_student_reflection()
    test_batch_nudge_and_engagement_calculation()
    test_google_meet_telemetry_flow()
