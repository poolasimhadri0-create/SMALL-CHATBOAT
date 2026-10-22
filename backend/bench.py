import time
import requests

start = time.time()
res = requests.post(
    "http://localhost:5000/api/chat",
    data={"message": "Reply in 3 words: Hello world"},
    stream=True
)
print("HTTP Status:", res.status_code)
first_token_time = None
tokens = []
for line in res.iter_lines():
    if line:
        decoded = line.decode("utf-8")
        if "token" in decoded:
            if first_token_time is None:
                first_token_time = time.time() - start
            tokens.append(decoded)
        elif "event: done" in decoded:
            break

total = time.time() - start
print(f"Time to first token: {first_token_time:.2f}s")
print(f"Total time: {total:.2f}s")
print(f"Received {len(tokens)} chunks")
