"""
fix_bookmarks_api.py — parameterized version of fix_bookmarks.py.
Accepts the unpacked docx base directory as the first CLI argument.
Usage: python3 fix_bookmarks_api.py /path/to/unpacked
"""
import sys
import re
import os
from lxml import etree

BASE = sys.argv[1] if len(sys.argv) > 1 else '/sessions/vigilant-relaxed-bohr/unpacked'

BG_COLOR  = '1E1E24'
W_NS   = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
WP_NS  = 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing'
A_NS   = 'http://schemas.openxmlformats.org/drawingml/2006/main'
WPS_NS = 'http://schemas.microsoft.com/office/word/2010/wordprocessingShape'
W      = f'{{{W_NS}}}'

PAGE_W_EMU = 7_772_400
PAGE_H_EMU = 10_058_400

BG_RECT_XML = f'''\
<w:p
    xmlns:w="{W_NS}"
    xmlns:wp="{WP_NS}"
    xmlns:a="{A_NS}"
    xmlns:wps="{WPS_NS}">
  <w:r>
    <w:drawing>
      <wp:anchor
          distT="0" distB="0" distL="0" distR="0"
          simplePos="0" relativeHeight="2"
          behindDoc="1" locked="1"
          layoutInCell="1" allowOverlap="0">
        <wp:simplePos x="0" y="0"/>
        <wp:positionH relativeFrom="page">
          <wp:posOffset>0</wp:posOffset>
        </wp:positionH>
        <wp:positionV relativeFrom="page">
          <wp:posOffset>0</wp:posOffset>
        </wp:positionV>
        <wp:extent cx="{PAGE_W_EMU}" cy="{PAGE_H_EMU}"/>
        <wp:effectExtent l="0" t="0" r="0" b="0"/>
        <wp:wrapNone/>
        <wp:docPr id="9999" name="PageBackground" descr="Full-page dark background"/>
        <wp:cNvGraphicFramePr/>
        <a:graphic>
          <a:graphicData
              uri="http://schemas.microsoft.com/office/word/2010/wordprocessingShape">
            <wps:wsp>
              <wps:cNvSpPr>
                <a:spLocks noChangeArrowheads="1"/>
              </wps:cNvSpPr>
              <wps:spPr>
                <a:xfrm>
                  <a:off x="0" y="0"/>
                  <a:ext cx="{PAGE_W_EMU}" cy="{PAGE_H_EMU}"/>
                </a:xfrm>
                <a:prstGeom prst="rect">
                  <a:avLst/>
                </a:prstGeom>
                <a:solidFill>
                  <a:srgbClr val="{BG_COLOR}"/>
                </a:solidFill>
                <a:ln>
                  <a:noFill/>
                </a:ln>
              </wps:spPr>
              <wps:bodyPr/>
            </wps:wsp>
          </a:graphicData>
        </a:graphic>
      </wp:anchor>
    </w:drawing>
  </w:r>
</w:p>'''

def find_content_header_path(base):
    import xml.etree.ElementTree as ET
    doc_xml  = f'{base}/word/document.xml'
    rels_xml = f'{base}/word/_rels/document.xml.rels'
    rels_tree = ET.parse(rels_xml)
    REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
    rid_to_target = {
        r.get('Id'): r.get('Target')
        for r in rels_tree.getroot().findall(f'{{{REL_NS}}}Relationship')
    }
    with open(doc_xml, 'r', encoding='utf-8') as f:
        xml = f.read()
    sect_blocks = re.findall(r'<w:sectPr\b.*?</w:sectPr>', xml, re.DOTALL)
    if not sect_blocks:
        return f'{base}/word/header1.xml'
    last_sect = sect_blocks[-1]
    hdr_match = re.search(r'<w:headerReference[^>]+w:type="default"[^>]+r:id="([^"]+)"', last_sect)
    if not hdr_match:
        hdr_match = re.search(r'<w:headerReference[^>]+r:id="([^"]+)"', last_sect)
    if not hdr_match:
        return f'{base}/word/header1.xml'
    rid = hdr_match.group(1)
    target = rid_to_target.get(rid, 'header1.xml')
    filename = target.split('/')[-1]
    return f'{base}/word/{filename}'

def find_cover_header_path(base):
    import xml.etree.ElementTree as ET
    rels_tree = ET.parse(f'{base}/word/_rels/document.xml.rels')
    REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
    rid_to_target = {
        r.get('Id'): r.get('Target')
        for r in rels_tree.getroot().findall(f'{{{REL_NS}}}Relationship')
    }
    with open(f'{base}/word/document.xml', 'r', encoding='utf-8') as f:
        xml = f.read()
    sect_blocks = re.findall(r'<w:sectPr\b.*?</w:sectPr>', xml, re.DOTALL)
    if len(sect_blocks) < 2:
        return None
    m = re.search(r'<w:headerReference[^>]+r:id="([^"]+)"', sect_blocks[0])
    if not m:
        return None
    target = rid_to_target.get(m.group(1), '')
    filename = target.split('/')[-1]
    return f'{base}/word/{filename}' if filename else None

for prefix, uri in [
    ('w', W_NS), ('wp', WP_NS), ('a', A_NS), ('wps', WPS_NS),
    ('mc', 'http://schemas.openxmlformats.org/markup-compatibility/2006'),
    ('r',  'http://schemas.openxmlformats.org/officeDocument/2006/relationships'),
    ('v',  'urn:schemas-microsoft-com:vml'),
    ('wp14','http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing'),
    ('w14','http://schemas.microsoft.com/office/word/2010/wordml'),
    ('w15','http://schemas.microsoft.com/office/word/2012/wordml'),
]:
    try: etree.register_namespace(prefix, uri)
    except Exception: pass

# ── 1. Background rectangle in content header ─────────────────────────────────
header_path = find_content_header_path(BASE)
tree = etree.parse(header_path)
root = tree.getroot()
for p in list(root):
    for anchor in p.iter(f'{{{WP_NS}}}anchor'):
        docPr = anchor.find(f'{{{WP_NS}}}docPr')
        if docPr is not None and docPr.get('name') == 'PageBackground':
            root.remove(p)
            break
bg_elem = etree.fromstring(BG_RECT_XML.encode('utf-8'))
root.insert(0, bg_elem)
tree.write(header_path, xml_declaration=True, encoding='UTF-8', standalone=True)

# ── 1b. Cover header framePr ──────────────────────────────────────────────────
cover_hdr = find_cover_header_path(BASE)
if cover_hdr and os.path.exists(cover_hdr):
    ct = etree.parse(cover_hdr)
    cr = ct.getroot()
    for p in cr.iter(f'{W}p'):
        pPr = p.find(f'{W}pPr')
        if pPr is None:
            pPr = etree.SubElement(p, f'{W}pPr')
            p.insert(0, pPr)
        for old in pPr.findall(f'{W}framePr'):
            pPr.remove(old)
        fp = etree.Element(f'{W}framePr')
        fp.set(f'{W}w', '1'); fp.set(f'{W}h', '1')
        fp.set(f'{W}hAnchor', 'page'); fp.set(f'{W}vAnchor', 'page')
        fp.set(f'{W}x', '0'); fp.set(f'{W}y', '0')
        pPr.insert(0, fp)
    ct.write(cover_hdr, xml_declaration=True, encoding='UTF-8', standalone=True)

# ── 2. Remove per-paragraph shading ───────────────────────────────────────────
doc_path = f'{BASE}/word/document.xml'
tree = etree.parse(doc_path)
root = tree.getroot()
removed = 0
for pPr in root.iter(f'{W}pPr'):
    parent = pPr.getparent()
    if parent is not None and parent.tag == f'{W}tcPr':
        continue
    shd = pPr.find(f'{W}shd')
    if shd is not None and shd.get(f'{W}fill') == BG_COLOR:
        pPr.remove(shd)
        removed += 1
tree.write(doc_path, xml_declaration=True, encoding='UTF-8', standalone=True)

# ── 3. VML background + displayBackgroundShape ────────────────────────────────
BG_REPLACEMENT = (
    f'<w:background w:color="{BG_COLOR}">'
    f'<v:background xmlns:v="urn:schemas-microsoft-com:vml"'
    f' id="_x0000_s1025" filled="t" fillcolor="#{BG_COLOR}">'
    f'<v:fill type="solid" color="#{BG_COLOR}" on="t"/>'
    f'</v:background>'
    f'</w:background>'
)
with open(doc_path, 'r', encoding='utf-8') as f:
    xml = f.read()
xml = re.sub(r'<w:background\b[^>]*/>', BG_REPLACEMENT, xml)
xml = re.sub(r'<w:background\b[^>]*>.*?</w:background>', BG_REPLACEMENT, xml, flags=re.DOTALL)
with open(doc_path, 'w', encoding='utf-8') as f:
    f.write(xml)

settings_path = f'{BASE}/word/settings.xml'
with open(settings_path, 'r', encoding='utf-8') as f:
    settings = f.read()
if '<w:displayBackgroundShape' not in settings:
    settings = re.sub(r'(<w:settings\b[^>]*>)', r'\1<w:displayBackgroundShape/>', settings)
    with open(settings_path, 'w', encoding='utf-8') as f:
        f.write(settings)

# ── 4. Fix bookmark IDs ───────────────────────────────────────────────────────
with open(doc_path, 'r', encoding='utf-8') as f:
    xml = f.read()
counter = [0]
name_to_id = {}
def replace_start(m):
    full = m.group(0)
    nm = re.search(r'w:name="([^"]*)"', full)
    name = nm.group(1) if nm else f'_unnamed_{counter[0]}'
    counter[0] += 1
    name_to_id[name] = str(counter[0])
    return re.sub(r'w:id="[^"]*"', f'w:id="{counter[0]}"', full)
xml = re.sub(r'<w:bookmarkStart\b[^/]*/>', replace_start, xml)
xml = re.sub(r'<w:bookmarkStart\b[^>]*>',  replace_start, xml)
end_counter = [0]
def replace_end(m):
    end_counter[0] += 1
    return re.sub(r'w:id="[^"]*"', f'w:id="{end_counter[0]}"', m.group(0))
xml = re.sub(r'<w:bookmarkEnd\b[^/]*/>', replace_end, xml)
xml = re.sub(r'<w:bookmarkEnd\b[^>]*>',  replace_end, xml)
with open(doc_path, 'w', encoding='utf-8') as f:
    f.write(xml)

print(f"OK: {counter[0]} bookmarks fixed, {removed} shading entries removed")
