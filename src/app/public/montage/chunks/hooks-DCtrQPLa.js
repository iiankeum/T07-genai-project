import { b as e, d as t, u as n, x as r } from "./runtime-BbGHn2yV.js";
// node_modules/@montage-ui/core/dist/components/form-control/constants.mjs
var i = "FormControl", a = {
	large: "large",
	medium: "medium"
}, o = { IconButton: { normal: {
	size: a,
	interactionOverflow: !0,
	color: "semantic.foreground.neutral.tertiary"
} } }, [s, c] = n(i), [l, u] = t("AnyComponent"), [d, f] = t("AnyComponent"), p = (e, t, n) => {
	let i = u(), a = i ? {
		size: i.size,
		responsive: i.responsive
	} : n, o = r({
		base: e,
		responsive: t
	}, a && {
		base: a.size,
		responsive: a.responsive
	}, "size");
	return {
		size: o.base ?? "large",
		...o.responsive
	};
}, m = (t) => {
	let n = f();
	if (!n || !t) return;
	let r = ({ size: t, ...r }) => ({
		...r,
		size: n.size && t[n.size],
		responsive: n.responsive && e(n.responsive, "size", (e) => t[e])
	}), { IconButton: i, ...a } = t;
	return {
		...Object.fromEntries(Object.entries(a).map(([e, t]) => [e, r(t)])),
		...i && { IconButton: Object.fromEntries(Object.entries(i).map(([e, t]) => [e, r(t)])) }
	};
};
export { o as a, a as i, m as n, d as r, p as t };
