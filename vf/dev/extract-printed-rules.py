"""Create searchable component references from the supplied glossary (no artwork)."""
import pathlib,re,json
root=pathlib.Path(__file__).resolve().parents[1]
text=(root/'resources/VOIDFALL-Glossary-websafe.txt').read_text(encoding='utf-8')
source=root/'resources/solo-source'
records={}
for filename,lower,upper in [('53-techs.js',24,30),('51-crisis.js',40,45),('29-events.js',34,39),('25-agendas.js',31,33)]:
    code=(source/filename).read_text(encoding='utf-8')
    names=set(re.findall(r"name:\s*'([^'\n]+)'",code))
    pages=[]
    for match in re.finditer(r'=== PAGE (\d+) ===\n(.*?)(?=\n=== PAGE |\Z)',text,re.S):
        page=int(match[1])
        if lower<=page<=upper:pages.append((page,match[2]))
    joined=''; offsets=[]
    for page,content in pages:
        offsets.append((len(joined),page))
        joined+=' '+re.sub(r'\s+',' ',content)
    matches=[]
    for name in names:
        pattern=r'(?<![A-Z])'+r'\s+'.join(re.escape(w) for w in name.upper().split())+r'\s+'
        match=re.search(pattern,joined)
        if match:matches.append((match.start(),match.end(),name))
    matches.sort()
    for i,(begin,end,name) in enumerate(matches):
        finish=matches[i+1][0] if i+1<len(matches) else len(joined)
        body=joined[end:finish].strip()
        page=max((p for off,p in offsets if off<=begin),default=lower)
        body=re.sub(r'(\w)-\s+(\w)',r'\1\2',body)
        records[name.lower()]={'text':body,'page':page}
(root/'js/printed-rules.js').write_text('// Component text from the supplied Voidfall Glossary. See docs/SOURCES.md.\nexport const printedRules = '+json.dumps(records,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
print('Extracted',len(records),'component references')
