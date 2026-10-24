"""Send a bounded async snippet from stdin to the live loopback controller."""
import sys
import urllib.request

request = urllib.request.Request('http://127.0.0.1:18349', data=sys.stdin.buffer.read(), method='POST')
with urllib.request.urlopen(request, timeout=60) as response:
    print(response.read().decode())
