#!/usr/bin/env python3
"""Fetch the released JSXGraph runtime from npm and verify it; --check compares the bundled copy."""
import argparse
import base64
import hashlib
import io
import json
from pathlib import Path
import tarfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
EXTENSION = ROOT / '_extensions/jsxgraph'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='compare instead of writing')
    args = parser.parse_args()
    record = json.loads((EXTENSION / 'upstream-runtime.json').read_text())
    data = urllib.request.urlopen(record['npm']['tarball'], timeout=120).read()
    algorithm, expected = record['npm']['integrity'].split('-', 1)
    if algorithm != 'sha512' or base64.b64encode(hashlib.sha512(data).digest()).decode() != expected:
        raise SystemExit('npm tarball integrity mismatch')
    with tarfile.open(fileobj=io.BytesIO(data)) as package:
        files = {name: package.extractfile(source).read() for name, source in record['sources'].items()}
    if set(files) != set(record['files']):
        raise SystemExit('Unexpected runtime inventory')
    for name, content in files.items():
        if hashlib.sha256(content).hexdigest() != record['files'][name]:
            raise SystemExit('Released file differs from the recorded hash: ' + name)
        target = EXTENSION / name
        if args.check:
            if target.read_bytes() != content:
                raise SystemExit('Bundled file differs from the npm release: ' + name)
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(content)
    print('JSXGraph ' + record['runtimeVersion'] + ': npm integrity, recorded hashes and bundled files agree.')


if __name__ == '__main__':
    main()
