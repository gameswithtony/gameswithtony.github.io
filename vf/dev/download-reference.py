"""Download the same reference sheets listed by the original app's offline loader."""
import concurrent.futures, json, pathlib, urllib.request
root = pathlib.Path(__file__).resolve().parents[1] / 'resources'
data = json.loads((root / 'asset-manifest.json').read_text(encoding='utf-8'))
output = root / 'reference-images'
output.mkdir(exist_ok=True)
urls = sorted({v['url'] for group in data.values() for v in group.values()})
def download(relative):
    file = output / pathlib.PurePosixPath(relative).name
    if file.exists() and file.stat().st_size > 0:
        return {'url': relative, 'file': file.name, 'bytes': file.stat().st_size}
    try:
        with urllib.request.urlopen('https://voidfall-solo-app.surge.sh/' + relative, timeout=90) as response:
            content = response.read()
        if content[:20].lower().lstrip().startswith(b'<!doctype'):
            raise ValueError('Server returned HTML')
        file.write_bytes(content)
        return {'url': relative, 'file': file.name, 'bytes': len(content)}
    except Exception as error:
        return {'url': relative, 'error': str(error)}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    results = list(pool.map(download, urls))
(root / 'asset-downloads.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
print(json.dumps({'downloaded': sum('bytes' in r for r in results), 'failed': [r for r in results if 'error' in r], 'bytes':sum(r.get('bytes',0) for r in results)}))
