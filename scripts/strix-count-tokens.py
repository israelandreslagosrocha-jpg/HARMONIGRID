"""Count locally; never prints prompt content or calls the model API."""
import json
import sys
import tiktoken

payload = sys.stdin.read()
body = json.loads(payload)
encoding = tiktoken.encoding_for_model("gpt-5.4")
count = lambda text: len(encoding.encode(text, disallowed_special=()))
# Compare serialized total with separately encoded messages/tools to avoid
# boundary merges reducing the estimate. Relay adds a large framing allowance.
parts = sum(count(json.dumps(message, ensure_ascii=False)) for message in body["messages"])
parts += count(json.dumps(body.get("tools", []), ensure_ascii=False))
print(max(count(payload), parts))
