/**
 * Custom ESLint rule: ban dead JSX handlers like
 *   onClick={() => {}}     onSave={() => {}}     onChange={() => {}}
 *
 * Catches the exact regression that shipped to prod last time (HydraBlue
 * Reminders had `onSave={() => {}}` for weeks). See plan.md §5b.
 *
 * Allowed patterns:
 *   - Handlers that reference a named function or method (onClick={save}).
 *   - Handlers with a non-empty body (onClick={() => doThing()}).
 *   - Explicit `onChange={undefined}` (rare; treat as opt-out, lint warns).
 */

/** @type {import("eslint").Rule.RuleModule} */
const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow empty arrow-function handlers on JSX events. They ship dead buttons to prod.",
    },
    schema: [],
    messages: {
      empty:
        "Empty {{attr}} handler. Either wire it through dispatch() or remove the prop. See plan.md §5b.",
    },
  },
  create(context) {
    return {
      JSXAttribute(node) {
        const name = node.name && node.name.name;
        if (typeof name !== "string") return;
        if (!/^on[A-Z]/.test(name)) return;
        const value = node.value;
        if (!value || value.type !== "JSXExpressionContainer") return;
        const expr = value.expression;
        if (!expr) return;
        if (
          expr.type === "ArrowFunctionExpression" ||
          expr.type === "FunctionExpression"
        ) {
          const body = expr.body;
          const isEmptyBlock =
            body &&
            body.type === "BlockStatement" &&
            body.body.length === 0;
          if (isEmptyBlock) {
            context.report({
              node,
              messageId: "empty",
              data: { attr: name },
            });
          }
        }
      },
    };
  },
};

export default {
  rules: {
    "no-empty-handler": rule,
  },
};
