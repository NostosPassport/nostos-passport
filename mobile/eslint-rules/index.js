/**
 * Local lint rules that enforce the design system (see src/theme/).
 *
 * - no-raw-design-values: raw colors (hex, rgb[a], hsl[a]) anywhere outside src/theme/, and raw
 *   numbers for spacing, radius, size or type properties in style objects.
 * - no-emoji: emoji in UI strings. SF Symbols only.
 */
const COLOR_RE = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\s*\(/;

// CSS named colors (React Native accepts all of them). Matched only when the whole string is a color name.
const NAMED_COLORS = new Set(
  (
    "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood " +
    "cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray " +
    "darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen " +
    "darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue " +
    "firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew " +
    "hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan " +
    "lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray " +
    "lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid " +
    "mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream " +
    "mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen " +
    "paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown " +
    "royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow " +
    "springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen transparent"
  ).split(" "),
);

// Props and style keys whose value is a color.
const COLOR_KEYS = /(?:^|[a-z])(?:[cC]olor|tint|Tint)$|^(?:backgroundColor|color|tintColor|shadowColor|borderColor|placeholderTextColor|selectionColor|underlayColor|tint)$/;

const STYLE_KEYS = new Set([
  "padding", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "paddingHorizontal", "paddingVertical", "paddingStart", "paddingEnd",
  "margin", "marginTop", "marginBottom", "marginLeft", "marginRight", "marginHorizontal", "marginVertical", "marginStart", "marginEnd",
  "gap", "rowGap", "columnGap",
  "top", "bottom", "left", "right",
  "width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight",
  "borderRadius", "borderTopLeftRadius", "borderTopRightRadius", "borderBottomLeftRadius", "borderBottomRightRadius",
  "borderWidth", "borderTopWidth", "borderBottomWidth", "borderLeftWidth", "borderRightWidth",
  "fontSize", "lineHeight", "letterSpacing", "shadowRadius", "flexBasis",
]);

// Numeric JSX props that are sizes.
const SIZE_PROPS = new Set(["size", "hitSlop", "strokeWidth", "iconSize"]);

function keyName(node) {
  if (!node) return null;
  if (node.type === "Identifier") return node.name;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  return null;
}

function numericLiteral(node) {
  if (node.type === "Literal" && typeof node.value === "number") return node.value;
  if (node.type === "UnaryExpression" && node.operator === "-" && node.argument.type === "Literal" && typeof node.argument.value === "number") {
    return -node.argument.value;
  }
  // Pure arithmetic on literals (`4 * 3`) is a raw value in disguise. Token math (`size.marker / 2`) is fine.
  if (node.type === "BinaryExpression") {
    const l = numericLiteral(node.left);
    const r = numericLiteral(node.right);
    if (l !== null && r !== null) return l;
  }
  return null;
}

function stringValue(node) {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) return node.quasis[0].value.cooked;
  return null;
}

const noRawDesignValues = {
  meta: {
    type: "problem",
    docs: { description: "Colors, spacing, radius, size and type values must come from src/theme." },
    messages: {
      color: "Raw color '{{value}}'. Use a token from src/theme/colors.ts.",
      number: "Raw {{key}}: {{value}}. Use a token from src/theme (space, radius, size, type).",
    },
    schema: [],
  },
  create(context) {
    const checkString = (node, value) => {
      if (typeof value === "string" && COLOR_RE.test(value)) {
        context.report({ node, messageId: "color", data: { value: value.length > 40 ? `${value.slice(0, 40)}…` : value } });
      }
    };
    return {
      Literal(node) {
        checkString(node, node.value);
      },
      TemplateElement(node) {
        checkString(node, node.value.cooked);
      },
      Property(node) {
        const key = keyName(node.key);
        if (!key) return;
        const str = stringValue(node.value);
        if (str !== null && COLOR_KEYS.test(key) && NAMED_COLORS.has(str.trim().toLowerCase())) {
          context.report({ node: node.value, messageId: "color", data: { value: str } });
        }
        if (!STYLE_KEYS.has(key)) return;
        const n = numericLiteral(node.value);
        // 0 is not a design value; everything else must be a token.
        if (n !== null && n !== 0) context.report({ node: node.value, messageId: "number", data: { key, value: String(n) } });
      },
      JSXAttribute(node) {
        const key = node.name && node.name.name;
        if (typeof key !== "string") return;
        const expr = node.value && node.value.type === "JSXExpressionContainer" ? node.value.expression : node.value;
        const str = stringValue(expr);
        if (str !== null && COLOR_KEYS.test(key) && NAMED_COLORS.has(str.trim().toLowerCase())) {
          context.report({ node: expr, messageId: "color", data: { value: str } });
        }
        if (!STYLE_KEYS.has(key) && !SIZE_PROPS.has(key)) return;
        const n = expr ? numericLiteral(expr) : null;
        if (n !== null && n !== 0) context.report({ node: expr, messageId: "number", data: { key, value: String(n) } });
      },
      CallExpression(node) {
        // PlatformColor("systemRed") bypasses the palette.
        if (node.callee.type === "Identifier" && (node.callee.name === "PlatformColor" || node.callee.name === "DynamicColorIOS")) {
          context.report({ node, messageId: "color", data: { value: node.callee.name } });
        }
      },
    };
  },
};

// Extended_Pictographic covers emoji; exclude the ASCII-range symbols (#, *, digits) it also matches.
const EMOJI_RE = /(?![#*0-9©®])\p{Extended_Pictographic}/u;

const noEmoji = {
  meta: {
    type: "problem",
    docs: { description: "No emoji in the UI. Use SF Symbols via the Icon component." },
    messages: { emoji: "Emoji in UI text. Use an SF Symbol (components/ui/icon) instead." },
    schema: [],
  },
  create(context) {
    const check = (node, value) => {
      if (typeof value === "string" && EMOJI_RE.test(value)) context.report({ node, messageId: "emoji" });
    };
    return {
      Literal: (node) => check(node, node.value),
      TemplateElement: (node) => check(node, node.value.cooked),
      JSXText: (node) => check(node, node.value),
    };
  },
};

module.exports = { rules: { "no-raw-design-values": noRawDesignValues, "no-emoji": noEmoji } };
