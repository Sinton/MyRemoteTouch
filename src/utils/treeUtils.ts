import { TreeNode } from '../store/useSmartTaskStore';

/**
 * 判定一个节点是否处于屏幕外（或隐身）状态
 * 依据：WDA 提供的 visible="false" 属性，或者坐标完全落在物理边界之外。
 */
export const isNodeOffScreen = (node: TreeNode, deviceW: number, deviceH: number): boolean => {
  // 1. WDA 原生显式标记不可见
  if (node.attributes.visible === 'false') return true;

  // 2. 坐标与宽高有效性检查（WDA 偶尔会返回负数奇葩宽高的无效节点）
  const { x, y, width, height } = node.rect;
  if (width <= 0 || height <= 0) return true;

  // 3. 几何边界越界检查（完全不在 0~deviceW / 0~deviceH 之内）
  if (x >= deviceW || x + width <= 0) return true;
  if (y >= deviceH || y + height <= 0) return true;

  return false;
};

/**
 * Find the most specific (deepest) node that contains the given point.
 * [优化] 增加了一层防御拦截，不可见节点直接被忽略，不被光标拾取。
 */
export const findNodeByCoord = (
  node: TreeNode,
  x: number,
  y: number,
  deviceW?: number,
  deviceH?: number
): TreeNode | null => {
  // 防御：幽灵节点拦截（如果它是完全不可见的，放弃拾取自身及其子节点）
  if (node.attributes.visible === 'false') return null;
  if (deviceW && deviceH && isNodeOffScreen(node, deviceW, deviceH)) return null;

  const isInRect =
    x >= node.rect.x &&
    x <= node.rect.x + node.rect.width &&
    y >= node.rect.y &&
    y <= node.rect.y + node.rect.height;

  // 虽然自己不在 Rect 内，但也许子节点会有一些绝对定位超出的情况（WDA 偶发）
  // 为了安全，依然允许向内搜索，但如果自己不在 Rect 且也没子集，就不可能匹配
  if (!isInRect && node.children.length === 0) return null;

  for (let i = node.children.length - 1; i >= 0; i--) {
    const childMatch = findNodeByCoord(node.children[i], x, y, deviceW, deviceH);
    if (childMatch) return childMatch;
  }

  return isInRect ? node : null;
};

/**
 * Find a node by its path (dot-separated index, e.g. "0.1.3")
 */
export const findNodeById = (node: TreeNode, pathOrId: string): TreeNode | null => {
  if (node.path === pathOrId) return node;
  if (node.elementId && node.elementId === pathOrId) return node;

  for (const child of node.children) {
    const found = findNodeById(child, pathOrId);
    if (found) return found;
  }

  return null;
};

// ─── 核心：从 XML 源码解析树结构 (对标 Appium Inspector 的 xmlToJSON) ────────

/**
 * Parse WDA XML source string into TreeNode tree.
 *
 * 直接解析 XML 源码，这样：
 * - tagName 天然带有 XCUIElementType 前缀 (如 <XCUIElementTypeCell>)
 * - 属性直接从 XML attribute 读取 (enabled="true" 等)
 * - 坐标从 x/y/width/height 属性提取
 *
 * 参考: appium-inspector/app/common/renderer/utils/source-parsing.js → xmlToJSON()
 */
export const parseXmlSourceToTree = (xmlString: string): TreeNode | null => {
  if (!xmlString || !xmlString.trim()) return null;

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    // 检查解析错误
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.error('XML Parse Error:', parseError.textContent);
      return null;
    }

    // 获取根元素 (跳过 xml declaration)
    const root = doc.documentElement;
    if (!root) return null;

    return translateDomNode(root, '', null);
  } catch (e) {
    console.error('XML Source Parse Error:', e);
    return null;
  }
};

/**
 * 递归将 DOM 节点转换为 TreeNode
 * 对标 Appium Inspector 的 translateRecursively()
 */
function translateDomNode(
  domNode: Element,
  parentPath: string,
  index: number | null
): TreeNode {
  // ── 提取属性 ──────────────────────────────────────────────────────
  const attributes: Record<string, string> = {};
  for (let i = 0; i < domNode.attributes.length; i++) {
    const attr = domNode.attributes.item(i);
    if (attr) {
      // 与 Appium Inspector 一致：将换行符转义为可见的 \n
      attributes[attr.name] = attr.value.replace(/(\n)/gm, '\\n');
    }
  }

  // ── 生成 path (dot-separated，与 Appium Inspector 完全一致) ────────
  const path = index === null ? '' : `${parentPath ? parentPath + '.' : ''}${index}`;

  // ── 提取子元素节点 (忽略 text/comment 等非 element 节点) ──────────
  const childElements: Element[] = [];
  for (let i = 0; i < domNode.childNodes.length; i++) {
    const child = domNode.childNodes[i];
    if (child.nodeType === Node.ELEMENT_NODE) {
      childElements.push(child as Element);
    }
  }

  // ── tagName 就是完整的 XCUIElementType 名 ─────────────────────────
  const tagName = domNode.tagName; // e.g. "XCUIElementTypeCell"

  // ── 从 XML 属性提取坐标 (WDA XML 标准属性名) ─────────────────────
  const x      = parseFloat(attributes.x      || '0');
  const y      = parseFloat(attributes.y      || '0');
  const width  = parseFloat(attributes.width  || '0');
  const height = parseFloat(attributes.height || '0');

  // ── 显示标签：优先 label > name > value ───────────────────────────
  const label = attributes.label || attributes.name || attributes.value || '';

  return {
    type: tagName,
    label,
    rect: { x, y, width, height },
    attributes,
    path,
    elementId: undefined, // WDA /source 不返回 elementId，后续通过 findElement 获取
    children: childElements.map((child, i) => translateDomNode(child, path, i)),
  };
}

// ─── Legacy: 保留 JSON 解析作为备用 ──────────────────────────────────────────

const ATTR_ALIAS: Record<string, string> = {
  isEnabled:    'enabled',
  isVisible:    'visible',
  isAccessible: 'accessible',
  elementType:  'type',
};

const normalizeType = (raw: string): string => {
  const typeStr = String(raw || 'Unknown');
  if (typeStr === 'Unknown') return typeStr;
  if (typeStr.startsWith('XCUIElementType')) return typeStr;
  return `XCUIElementType${typeStr}`;
};

export const parseWdaJsonToTree = (node: any, parentPath: string = '0'): TreeNode | null => {
  if (!node) return null;
  try {
    const guid = node['element-6066-11e4-a52e-4f735466cecf'] || node.ELEMENT || node.uid || node.uuid || '';
    const attrs: Record<string, string> = {};
    const extractInfo = (data: any) => {
      if (!data || typeof data !== 'object') return;
      Object.entries(data).forEach(([k, v]) => {
        if (typeof v !== 'object' && v !== null && v !== undefined) {
          attrs[ATTR_ALIAS[k] || k] = String(v);
        }
      });
    };
    extractInfo(node);
    if (node.attributes && typeof node.attributes === 'object') extractInfo(node.attributes);
    if (guid) attrs['elementId'] = guid;
    const rect = node.rect || { x: 0, y: 0, width: 0, height: 0 };
    const fullType = normalizeType(node.type || node.elementType || 'Unknown');
    attrs['type'] = fullType;
    return {
      type: fullType,
      label: node.label || node.name || node.value || '',
      rect: { x: rect.x || 0, y: rect.y || 0, width: rect.width || 0, height: rect.height || 0 },
      attributes: attrs,
      elementId: guid || undefined,
      path: parentPath,
      children: (node.children || [])
                  .map((child: any, i: number) => parseWdaJsonToTree(child, `${parentPath}.${i}`))
                  .filter((c: any) => c !== null),
    };
  } catch (e) {
    console.error('WDA JSON Engine Error:', e);
    return null;
  }
};
