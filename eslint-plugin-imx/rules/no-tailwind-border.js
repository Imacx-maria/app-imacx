const DISALLOWED_PREFIX = "border";

// Allowed border classes from design system
const ALLOWED_BORDER_CLASSES = [
  "border-default",
  "border-collapse",
  "border-separate",
  "border-spacing-0",
];

/**
 * Normalize a Tailwind token by stripping modifiers/important flags.
 */
function normalizeToken(token) {
  if (!token) {
    return "";
  }
  let normalized = token.trim();
  if (!normalized) {
    return "";
  }
  // Remove important flag.
  if (normalized.startsWith("!")) {
    normalized = normalized.slice(1);
  }
  // Split variant prefixes (e.g. dark:hover:border-b).
  const parts = normalized.split(":");
  return parts[parts.length - 1];
}

function hasForbiddenClass(value) {
  if (typeof value !== "string") {
    return null;
  }
  const tokens = value.split(/\s+/);
  for (const originalToken of tokens) {
    const normalized = normalizeToken(originalToken);
    if (!normalized || normalized.startsWith("imx-")) {
      continue;
    }
    // Allow design-system approved border classes
    if (ALLOWED_BORDER_CLASSES.includes(normalized)) {
      continue;
    }
    if (normalized.startsWith(DISALLOWED_PREFIX)) {
      return originalToken;
    }
  }
  return null;
}

function collectStrings(node, callback) {
  if (!node) return;

  switch (node.type) {
    case "Literal":
      if (typeof node.value === "string") {
        callback(node.value, node);
      }
      break;
    case "TemplateLiteral":
      node.quasis.forEach((quasi) => {
        callback(quasi.value.cooked ?? quasi.value.raw, quasi);
      });
      break;
    case "TaggedTemplateExpression":
      collectStrings(node.quasi, callback);
      break;
    case "BinaryExpression":
    case "LogicalExpression":
      collectStrings(node.left, callback);
      collectStrings(node.right, callback);
      break;
    case "ConditionalExpression":
      collectStrings(node.consequent, callback);
      collectStrings(node.alternate, callback);
      break;
    case "ArrayExpression":
      node.elements.forEach((element) => {
        if (element) collectStrings(element, callback);
      });
      break;
    case "ObjectExpression":
      node.properties.forEach((prop) => {
        if (
          prop.type === "Property" &&
          !prop.computed &&
          !prop.method &&
          !prop.shorthand
        ) {
          if (prop.key.type === "Identifier") {
            callback(prop.key.name, prop.key);
          } else if (
            prop.key.type === "Literal" &&
            typeof prop.key.value === "string"
          ) {
            callback(prop.key.value, prop.key);
          }
        }
      });
      break;
    case "CallExpression":
      node.arguments.forEach((arg) => collectStrings(arg, callback));
      break;
    case "TemplateElement":
      callback(node.value.cooked ?? node.value.raw, node);
      break;
    case "JSXExpressionContainer":
      collectStrings(node.expression, callback);
      break;
    default:
      break;
  }
}

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow raw Tailwind border classes so the shared imx-border utilities stay enforced.",
      recommended: false,
    },
    schema: [],
    messages: {
      noTailwindBorder:
        "Replace `{{className}}` with the shared `imx-border*` utility instead of Tailwind's `border*` classes.",
    },
  },

  create(context) {
    function reportIfForbidden(value, node) {
      const offending = hasForbiddenClass(value);
      if (offending) {
        context.report({
          node,
          messageId: "noTailwindBorder",
          data: { className: offending },
        });
      }
    }

    function inspectAttributeValue(attrValue, node) {
      if (!attrValue) return;
      if (attrValue.type === "Literal") {
        reportIfForbidden(attrValue.value, attrValue);
        return;
      }
      if (attrValue.type === "JSXExpressionContainer") {
        collectStrings(attrValue.expression, (value, valueNode) => {
          reportIfForbidden(value, valueNode || node);
        });
      }
    }

    return {
      JSXAttribute(node) {
        const attrName = node.name && node.name.name;
        if (attrName !== "className" && attrName !== "class") {
          return;
        }
        inspectAttributeValue(node.value, node);
      },
    };
  },
};
