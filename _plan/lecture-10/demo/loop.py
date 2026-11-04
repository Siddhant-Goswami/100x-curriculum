"""Lecture 10 live demo: the three layers, in about thirty lines.
Layer 1, the LLM (GPT OSS on Groq) decides and writes a tool call.
Layer 2, this script: hands the call to the tool, checks the result, logs all three.
Layer 3, the tool: GET /api/workflows/{id}/diagnoses on the Lecture 8 app. Nothing new was built for tonight.

Run:  export GROQ_API_KEY=...  APP_URL=https://<your-app>.vercel.app
      python loop.py "How many plans has Aarav's app stored, and what did the last one say?"
Needs: pip install requests.
"""
import json, os, sys, requests

GROQ = "https://api.groq.com/openai/v1/chat/completions"
APP = os.environ["APP_URL"].rstrip("/")
KEY = os.environ["GROQ_API_KEY"]
tool = json.load(open(os.path.join(os.path.dirname(__file__), "tool.json")))   # the card the model reads

question = sys.argv[1] if len(sys.argv) > 1 else "How many plans has Aarav's app stored, and what did the last one say?"
messages = [{"role": "system", "content": "You help the team behind Aarav's workflow app. Aarav's workflow id is 1."},
            {"role": "user", "content": question}]

for _ in range(3):                                                    # the loop; the backend decides when it stops
    r = requests.post(GROQ, headers={"Authorization": "Bearer " + KEY},
                      json={"model": "openai/gpt-oss-120b", "messages": messages, "tools": [tool]}).json()
    msg = r["choices"][0]["message"]; messages.append(msg)
    if not msg.get("tool_calls"):                                     # no tool call: this is the answer
        print("answer ", msg["content"]); break
    for call in msg["tool_calls"]:                                    # the model asked; the orange box acts
        args = json.loads(call["function"]["arguments"])
        print("call   ", call["function"]["name"]); print("args   ", args)
        res = requests.get(f"{APP}/api/workflows/{int(args['workflow_id'])}/diagnoses")   # layer 3 runs
        ok = res.status_code == 200 and isinstance(res.json(), list)   # the verifier, written before the run
        print("result ", res.status_code, res.text.replace("\n", " ")[:100]); print("verify ", "pass" if ok else "fail")
        messages.append({"role": "tool", "tool_call_id": call["id"], "content": res.text if ok else '{"error": "no such workflow"}'})
