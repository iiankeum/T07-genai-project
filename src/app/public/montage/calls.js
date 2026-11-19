import { A as e, D as t, E as n, O as r, S as i, T as a, _ as o, a as s, b as c, c as l, j as u, k as d, m as f, n as p, r as m, t as h, v as g, w as _, y as v } from "./chunks/runtime-hdV0LhUM.js";
import { i as y, t as b } from "./chunks/hooks-zUJ_L3OF.js";
import { t as x } from "./chunks/icon-search-PcaNiANh.js";
// ../../../../../../../tmp/ahcha-shell-combined/app/node_modules/@montage-ui/core/dist/components/search-field/style.mjs
var S = ({ disabled: e, width: t = "initial", variant: n, size: r, xs: i, sm: o, md: s, lg: c, xl: l }) => (u) => _`
      display: flex;
      align-items: center;
      border: none;
      width: ${a(t)};
      cursor: text;

      ${C({ size: r }, u)}
      ${w({
	variant: n,
	disabled: e
}, u)}

      [data-role='search-field-icon'] {
        transition: color ease 0.2s;
        color: ${u.semantic.foreground.neutral.tertiary};
      }

      [data-role='search-field-reset'] {
        display: none;
      }

      [data-role='search-field-wrapper'] {
        padding: ${u.spacing[0]} ${u.spacing[4]};
        gap: ${u.spacing[2]};
        align-items: center;
        width: 100%;
        height: 100%;
      }

      ${e ? _`
              cursor: default;

              [data-role='search-field-icon'] {
                color: ${u.semantic.foreground.disable.primary};
              }

              [data-role='search-field-reset'] {
                display: none;
              }
            ` : _`
              &:where(:has(input:focus)) {
                [data-role='search-field-reset'] {
                  display: flex;
                }

                &:where(:has(input:placeholder-shown)) {
                  [data-role='search-field-reset'] {
                    display: none;
                  }
                }
              }
            `}

      input {
        caret-color: ${u.semantic.foreground.brand.primary};
        transition: color ease 0.2s;
        width: 100%;
        margin: 0;
        background-color: transparent;
        outline: none;
        border: none;
        box-shadow: none;
        color: ${u.semantic.foreground.neutral.primary};

        &::placeholder {
          color: ${u.semantic.foreground.neutral.tertiary};
        }

        &:disabled {
          color: ${u.semantic.foreground.disable.primary};

          &::placeholder {
            color: ${u.semantic.foreground.disable.primary};
          }
        }

        [type='number'] {
          -moz-appearance: textfield;
        }

        &::-webkit-inner-spin-button,
        &::-webkit-search-cancel-button,
        &::-webkit-search-cancel-button,
        &::-webkit-search-results-button,
        &::-webkit-search-results-decoration {
          appearance: none;
        }
      }

      ${v({
	xs: i,
	sm: o,
	md: s,
	lg: c,
	xl: l
}, u)((e) => _`
          ${e?.width !== void 0 && _`
              width: ${a(e.width)};
            `}

          ${C({ size: e?.size }, u)}

          ${e?.sx}
        `)}
    `, C = ({ size: e }, t) => {
	switch (e) {
		case "large": return _`
        padding: ${t.spacing[12]} ${t.spacing[8]};
        border-radius: ${t.radius[14]};
        min-height: ${t.dimension[48]};

        --search-field-icon-wrapper-size: ${t.dimension[24]};
        --search-field-icon-size: ${t.dimension[20]};

        input {
          padding: 1px ${t.spacing[4]};
          ${o("body2", "regular")}

          &::placeholder {
            ${o("body2", "regular")}
          }
        }
      `;
		case "medium": return _`
        padding: ${t.spacing[8]} ${t.spacing[6]};
        border-radius: ${t.radius[12]};
        min-height: ${t.dimension[40]};

        --search-field-icon-wrapper-size: ${t.dimension[20]};
        --search-field-icon-size: ${t.dimension[18]};

        input {
          padding: ${t.spacing[0]} ${t.spacing[4]};
          ${o("label1", "regular")}

          &::placeholder {
            ${o("label1", "regular")}
          }
        }
      `;
	}
}, w = ({ variant: e, disabled: t }, n) => {
	switch (e) {
		case "outlined": return _`
        background-color: ${n.semantic.effect.transparent.primary};
        backdrop-filter: blur(32px);
        box-shadow: 0 0 0 1px inset ${n.semantic.line.neutral.secondary};

        ${t && _`
            background-color: ${n.semantic.surface.neutral.tertiary};
            backdrop-filter: none;
            box-shadow: 0 0 0 1px inset ${n.semantic.line.neutral.tertiary};
          `}
      `;
		default:
		case "solid": return _`
        background-color: ${n.semantic.surface.neutral.secondary};
        backdrop-filter: blur(32px);
        box-shadow: none;

        ${t && _`
            background-color: ${n.semantic.surface.neutral.secondary};
            backdrop-filter: blur(32px);
            box-shadow: none;
          `}
      `;
	}
}, T = _`
  flex-shrink: 0;
  width: var(--search-field-icon-wrapper-size);
  height: var(--search-field-icon-wrapper-size);
  font-size: var(--search-field-icon-size);
`, E = /* @__PURE__ */ u(e(), 1), D = /* @__PURE__ */ u(n(), 1), O = (0, E.forwardRef)(({ className: e, disabled: n, style: r, onReset: a, width: o, variant: s = "solid", size: u, wrapperRef: d, sx: p, xs: h, sm: _, md: v, lg: C, xl: w, ...O }, k) => {
	let A = (0, E.useRef)(null), j = (0, E.useRef)(null), M = t(j, k), { SearchField: N } = f(), { size: P, ...F } = b(u, {
		xs: h,
		sm: _,
		md: v,
		lg: C,
		xl: w
	}, N);
	return (0, E.useEffect)(() => {
		let e = A.current;
		if (!e || n) return;
		let t = (e) => {
			e.target.closest("input, textarea, button, a, [data-role=\"search-field-reset\"], [contenteditable]") || (j.current?.click(), j.current?.focus());
		};
		return e.addEventListener("click", t), () => e.removeEventListener("click", t);
	}, [n]), /* @__PURE__ */ (0, D.jsx)(i, {
		className: e,
		style: r,
		"data-component": "search-field",
		ref: t(A, d),
		sx: [S({
			disabled: n,
			size: P,
			width: o,
			variant: s,
			...F,
			...O
		}), p],
		children: /* @__PURE__ */ (0, D.jsxs)(g, {
			"data-role": "search-field-wrapper",
			alignItems: "center",
			children: [
				/* @__PURE__ */ (0, D.jsx)(g, {
					"data-role": "search-field-icon",
					sx: T,
					alignItems: "center",
					justifyContent: "center",
					children: /* @__PURE__ */ (0, D.jsx)(x, {})
				}),
				/* @__PURE__ */ (0, D.jsx)("input", {
					ref: M,
					autoComplete: "off",
					disabled: n,
					"aria-disabled": n,
					...O,
					type: "search"
				}),
				/* @__PURE__ */ (0, D.jsx)(g, {
					"data-role": "search-field-reset",
					sx: T,
					alignItems: "center",
					justifyContent: "center",
					children: /* @__PURE__ */ (0, D.jsx)(m, {
						type: "button",
						tabIndex: -1,
						"aria-label": "Reset search",
						size: y[P],
						...c(F, "size", (e) => y[e]),
						interactionOverflow: !0,
						onPointerDown: (e) => e.preventDefault(),
						onClick: () => {
							let e = j.current;
							e && requestAnimationFrame(() => {
								let t = e.value, n = new Event("change", { bubbles: !0 });
								e.value = "", O.onChange?.({
									...n,
									target: e,
									currentTarget: e,
									nativeEvent: {
										...n,
										target: e,
										currentTarget: e
									},
									isDefaultPrevented: () => !1,
									isPropagationStopped: () => !1,
									persist: () => {}
								}), a?.(t), e.focus();
							});
						},
						sx: (e) => ({ color: e.semantic.foreground.neutral.quaternary }),
						children: /* @__PURE__ */ (0, D.jsx)(l, {})
					})
				})
			]
		})
	});
});
O.displayName = "SearchField";
// montage/calls.jsx
var k = r(), A = /* @__PURE__ */ u(d(), 1), j = h;
function M(e, { query: t }) {
	if (!e.isConnected) return null;
	let n = (0, k.createRoot)(e), r, i;
	try {
		if ((0, A.flushSync)(() => n.render(/* @__PURE__ */ (0, D.jsxs)(p, {
			disableDefaultGlobalStyle: !0,
			children: [/* @__PURE__ */ (0, D.jsx)(O, {
				ref: (e) => {
					r = e;
				},
				id: "cl-q",
				"aria-label": "통화 찾기",
				enterKeyHint: "search",
				autoComplete: "off",
				placeholder: "거래처, 차종, 부품 또는 차번호 검색",
				defaultValue: t,
				maxLength: 100,
				variant: "outlined",
				size: "large",
				width: "100%"
			}), /* @__PURE__ */ (0, D.jsx)(s, {
				ref: (e) => {
					i = e;
				},
				type: "button",
				variant: "outlined",
				color: "assistive",
				size: "large",
				"data-act": "clear-q",
				className: t ? "" : "hidden",
				"aria-label": "검색어 지우기",
				children: "지우기"
			})]
		}))), !r || !i) throw Error("Montage search controls did not mount");
		return {
			field: r,
			destroy: () => n.unmount()
		};
	} catch (e) {
		throw n.unmount(), e;
	}
}
function N(e) {
	e.classList.add("montage-scope");
	let t = (0, k.createRoot)(e);
	return {
		update(e, n) {
			(0, A.flushSync)(() => t.render(/* @__PURE__ */ (0, D.jsxs)(p, {
				disableDefaultGlobalStyle: !0,
				children: [/* @__PURE__ */ (0, D.jsx)("p", {
					className: "cl-group-label",
					id: "cl-status-l",
					children: "상태"
				}), /* @__PURE__ */ (0, D.jsx)("div", {
					className: "tabs cl-tabs cl-montage-statuses",
					role: "group",
					"aria-labelledby": "cl-status-l",
					children: e.map(([e, t]) => /* @__PURE__ */ (0, D.jsx)(s, {
						type: "button",
						"data-status": e,
						"aria-pressed": n === e,
						color: n === e ? "primary" : "assistive",
						size: "medium",
						variant: n === e ? "solid" : "outlined",
						children: t
					}, e))
				})]
			})));
		},
		destroy: () => t.unmount()
	};
}
export { M as mountMontageCallsSearch, N as mountMontageCallsStatuses, j as prepareMontageCalls };
