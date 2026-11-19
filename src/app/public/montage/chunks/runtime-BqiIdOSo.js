// \0rolldown/runtime.js
var e = Object.create, t = Object.defineProperty, n = Object.getOwnPropertyDescriptor, r = Object.getOwnPropertyNames, i = Object.getPrototypeOf, a = Object.prototype.hasOwnProperty, o = (e, t) => () => (t || (e((t = { exports: {} }).exports, t, t.exports), e = null), t.exports), s = (e, i, o, s) => {
	if (i && typeof i == "object" || typeof i == "function") for (var c = r(i), l = 0, u = c.length, d; l < u; l++) d = c[l], !a.call(e, d) && d !== o && t(e, d, {
		get: ((e) => i[e]).bind(null, d),
		enumerable: !(s = n(i, d)) || s.enumerable
	});
	return e;
}, c = (n, r, o) => (o = n == null ? {} : e(i(n)), s(r || !n || !n.__esModule || !a.call(n, "default") ? t(o, "default", {
	value: n,
	enumerable: !0
}) : o, n)), l = /* @__PURE__ */ o(((e) => {
	var t = Symbol.for("react.transitional.element"), n = Symbol.for("react.portal"), r = Symbol.for("react.fragment"), i = Symbol.for("react.strict_mode"), a = Symbol.for("react.profiler"), o = Symbol.for("react.consumer"), s = Symbol.for("react.context"), c = Symbol.for("react.forward_ref"), l = Symbol.for("react.suspense"), u = Symbol.for("react.memo"), d = Symbol.for("react.lazy"), f = Symbol.for("react.activity"), p = Symbol.for("react.view_transition"), m = Symbol.iterator;
	function h(e) {
		return typeof e != "object" || !e ? null : (e = m && e[m] || e["@@iterator"], typeof e == "function" ? e : null);
	}
	var g = {
		isMounted: function() {
			return !1;
		},
		enqueueForceUpdate: function() {},
		enqueueReplaceState: function() {},
		enqueueSetState: function() {}
	}, _ = Object.assign, v = {};
	function y(e, t, n) {
		this.props = e, this.context = t, this.refs = v, this.updater = n || g;
	}
	y.prototype.isReactComponent = {}, y.prototype.setState = function(e, t) {
		if (typeof e != "object" && typeof e != "function" && e != null) throw Error("takes an object of state variables to update or a function which returns an object of state variables.");
		this.updater.enqueueSetState(this, e, t, "setState");
	}, y.prototype.forceUpdate = function(e) {
		this.updater.enqueueForceUpdate(this, e, "forceUpdate");
	};
	function b() {}
	b.prototype = y.prototype;
	function x(e, t, n) {
		this.props = e, this.context = t, this.refs = v, this.updater = n || g;
	}
	var S = x.prototype = new b();
	S.constructor = x, _(S, y.prototype), S.isPureReactComponent = !0;
	var C = Array.isArray;
	function ee() {}
	var w = {
		H: null,
		A: null,
		T: null,
		S: null
	}, te = Object.prototype.hasOwnProperty;
	function T(e, n, r) {
		var i = r.ref;
		return {
			$$typeof: t,
			type: e,
			key: n,
			ref: i === void 0 ? null : i,
			props: r
		};
	}
	function ne(e, t) {
		return T(e.type, t, e.props);
	}
	function re(e) {
		return typeof e == "object" && !!e && e.$$typeof === t;
	}
	function ie(e) {
		var t = {
			"=": "=0",
			":": "=2"
		};
		return "$" + e.replace(/[=:]/g, function(e) {
			return t[e];
		});
	}
	var ae = /\/+/g;
	function oe(e, t) {
		return typeof e == "object" && e && e.key != null ? ie("" + e.key) : t.toString(36);
	}
	function se(e) {
		switch (e.status) {
			case "fulfilled": return e.value;
			case "rejected": throw e.reason;
			default: switch (typeof e.status == "string" ? e.then(ee, ee) : (e.status = "pending", e.then(function(t) {
				e.status === "pending" && (e.status = "fulfilled", e.value = t);
			}, function(t) {
				e.status === "pending" && (e.status = "rejected", e.reason = t);
			})), e.status) {
				case "fulfilled": return e.value;
				case "rejected": throw e.reason;
			}
		}
		throw e;
	}
	function ce(e, r, i, a, o) {
		var s = typeof e;
		(s === "undefined" || s === "boolean") && (e = null);
		var c = !1;
		if (e === null) c = !0;
		else switch (s) {
			case "bigint":
			case "string":
			case "number":
				c = !0;
				break;
			case "object": switch (e.$$typeof) {
				case t:
				case n:
					c = !0;
					break;
				case d: return c = e._init, ce(c(e._payload), r, i, a, o);
			}
		}
		if (c) return o = o(e), c = a === "" ? "." + oe(e, 0) : a, C(o) ? (i = "", c != null && (i = c.replace(ae, "$&/") + "/"), ce(o, r, i, "", function(e) {
			return e;
		})) : o != null && (re(o) && (o = ne(o, i + (o.key == null || e && e.key === o.key ? "" : ("" + o.key).replace(ae, "$&/") + "/") + c)), r.push(o)), 1;
		c = 0;
		var l = a === "" ? "." : a + ":";
		if (C(e)) for (var u = 0; u < e.length; u++) a = e[u], s = l + oe(a, u), c += ce(a, r, i, s, o);
		else if (u = h(e), typeof u == "function") for (e = u.call(e), u = 0; !(a = e.next()).done;) a = a.value, s = l + oe(a, u++), c += ce(a, r, i, s, o);
		else if (s === "object") {
			if (typeof e.then == "function") return ce(se(e), r, i, a, o);
			throw r = String(e), Error("Objects are not valid as a React child (found: " + (r === "[object Object]" ? "object with keys {" + Object.keys(e).join(", ") + "}" : r) + "). If you meant to render a collection of children, use an array instead.");
		}
		return c;
	}
	function le(e, t, n) {
		if (e == null) return e;
		var r = [], i = 0;
		return ce(e, r, "", "", function(e) {
			return t.call(n, e, i++);
		}), r;
	}
	function ue(e) {
		if (e._status === -1) {
			var t = e._result, n = t();
			n.then(function(t) {
				(e._status === 0 || e._status === -1) && (e._status = 1, e._result = t, n.status === void 0 && (n.status = "fulfilled", n.value = t));
			}, function(t) {
				(e._status === 0 || e._status === -1) && (e._status = 2, e._result = t, n.status === void 0 && (n.status = "rejected", n.reason = t));
			}), e._status === -1 && (e._status = 0, e._result = n);
		}
		if (e._status === 1) return e._result.default;
		throw e._result;
	}
	var de = typeof reportError == "function" ? reportError : function(e) {
		if (typeof window == "object" && typeof window.ErrorEvent == "function") {
			var t = new window.ErrorEvent("error", {
				bubbles: !0,
				cancelable: !0,
				message: typeof e == "object" && e && typeof e.message == "string" ? String(e.message) : String(e),
				error: e
			});
			if (!window.dispatchEvent(t)) return;
		} else if (typeof process == "object" && typeof process.emit == "function") {
			process.emit("uncaughtException", e);
			return;
		}
		console.error(e);
	};
	function fe(e) {
		var t = w.T, n = {};
		n.types = t === null ? null : t.types, w.T = n;
		try {
			var r = e(), i = w.S;
			i !== null && i(n, r), typeof r == "object" && r && typeof r.then == "function" && r.then(ee, de);
		} catch (e) {
			de(e);
		} finally {
			t !== null && n.types !== null && (t.types = n.types), w.T = t;
		}
	}
	function pe(e) {
		var t = w.T;
		if (t !== null) {
			var n = t.types;
			n === null ? t.types = [e] : n.indexOf(e) === -1 && n.push(e);
		} else fe(pe.bind(null, e));
	}
	var me = {
		map: le,
		forEach: function(e, t, n) {
			le(e, function() {
				t.apply(this, arguments);
			}, n);
		},
		count: function(e) {
			var t = 0;
			return le(e, function() {
				t++;
			}), t;
		},
		toArray: function(e) {
			return le(e, function(e) {
				return e;
			}) || [];
		},
		only: function(e) {
			if (!re(e)) throw Error("React.Children.only expected to receive a single React element child.");
			return e;
		}
	};
	e.Activity = f, e.Children = me, e.Component = y, e.Fragment = r, e.Profiler = a, e.PureComponent = x, e.StrictMode = i, e.Suspense = l, e.ViewTransition = p, e.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = w, e.__COMPILER_RUNTIME = {
		__proto__: null,
		c: function(e) {
			return w.H.useMemoCache(e);
		}
	}, e.addTransitionType = pe, e.cache = function(e) {
		return function() {
			return e.apply(null, arguments);
		};
	}, e.cacheSignal = function() {
		return null;
	}, e.cloneElement = function(e, t, n) {
		if (e == null) throw Error("The argument must be a React element, but you passed " + e + ".");
		var r = _({}, e.props), i = e.key;
		if (t != null) for (a in t.key !== void 0 && (i = "" + t.key), t) !te.call(t, a) || a === "key" || a === "__self" || a === "__source" || a === "ref" && t.ref === void 0 || (r[a] = t[a]);
		var a = arguments.length - 2;
		if (a === 1) r.children = n;
		else if (1 < a) {
			for (var o = Array(a), s = 0; s < a; s++) o[s] = arguments[s + 2];
			r.children = o;
		}
		return T(e.type, i, r);
	}, e.createContext = function(e) {
		return e = {
			$$typeof: s,
			_currentValue: e,
			_currentValue2: e,
			_threadCount: 0,
			Provider: null,
			Consumer: null
		}, e.Provider = e, e.Consumer = {
			$$typeof: o,
			_context: e
		}, e;
	}, e.createElement = function(e, t, n) {
		var r, i = {}, a = null;
		if (t != null) for (r in t.key !== void 0 && (a = "" + t.key), t) te.call(t, r) && r !== "key" && r !== "__self" && r !== "__source" && (i[r] = t[r]);
		var o = arguments.length - 2;
		if (o === 1) i.children = n;
		else if (1 < o) {
			for (var s = Array(o), c = 0; c < o; c++) s[c] = arguments[c + 2];
			i.children = s;
		}
		if (e && e.defaultProps) for (r in o = e.defaultProps, o) i[r] === void 0 && (i[r] = o[r]);
		return T(e, a, i);
	}, e.createRef = function() {
		return { current: null };
	}, e.forwardRef = function(e) {
		return {
			$$typeof: c,
			render: e
		};
	}, e.isValidElement = re, e.lazy = function(e) {
		return {
			$$typeof: d,
			_payload: {
				_status: -1,
				_result: e
			},
			_init: ue
		};
	}, e.memo = function(e, t) {
		return {
			$$typeof: u,
			type: e,
			compare: t === void 0 ? null : t
		};
	}, e.startTransition = fe, e.unstable_useCacheRefresh = function() {
		return w.H.useCacheRefresh();
	}, e.use = function(e) {
		return w.H.use(e);
	}, e.useActionState = function(e, t, n) {
		return w.H.useActionState(e, t, n);
	}, e.useCallback = function(e, t) {
		return w.H.useCallback(e, t);
	}, e.useContext = function(e) {
		return w.H.useContext(e);
	}, e.useDebugValue = function() {}, e.useDeferredValue = function(e, t) {
		return w.H.useDeferredValue(e, t);
	}, e.useEffect = function(e, t) {
		return w.H.useEffect(e, t);
	}, e.useEffectEvent = function(e) {
		return w.H.useEffectEvent(e);
	}, e.useId = function() {
		return w.H.useId();
	}, e.useImperativeHandle = function(e, t, n) {
		return w.H.useImperativeHandle(e, t, n);
	}, e.useInsertionEffect = function(e, t) {
		return w.H.useInsertionEffect(e, t);
	}, e.useLayoutEffect = function(e, t) {
		return w.H.useLayoutEffect(e, t);
	}, e.useMemo = function(e, t) {
		return w.H.useMemo(e, t);
	}, e.useOptimistic = function(e, t) {
		return w.H.useOptimistic(e, t);
	}, e.useReducer = function(e, t, n) {
		return w.H.useReducer(e, t, n);
	}, e.useRef = function(e) {
		return w.H.useRef(e);
	}, e.useState = function(e) {
		return w.H.useState(e);
	}, e.useSyncExternalStore = function(e, t, n) {
		return w.H.useSyncExternalStore(e, t, n);
	}, e.useTransition = function() {
		return w.H.useTransition();
	}, e.version = "19.3.1";
})), u = /* @__PURE__ */ o(((e, t) => {
	t.exports = l();
})), d = /* @__PURE__ */ o(((e) => {
	function t(e, t) {
		var n = e.length;
		e.push(t);
		a: for (; 0 < n;) {
			var r = n - 1 >>> 1, a = e[r];
			if (0 < i(a, t)) e[r] = t, e[n] = a, n = r;
			else break a;
		}
	}
	function n(e) {
		return e.length === 0 ? null : e[0];
	}
	function r(e) {
		if (e.length === 0) return null;
		var t = e[0], n = e.pop();
		if (n !== t) {
			e[0] = n;
			a: for (var r = 0, a = e.length, o = a >>> 1; r < o;) {
				var s = 2 * (r + 1) - 1, c = e[s], l = s + 1, u = e[l];
				if (0 > i(c, n)) l < a && 0 > i(u, c) ? (e[r] = u, e[l] = n, r = l) : (e[r] = c, e[s] = n, r = s);
				else if (l < a && 0 > i(u, n)) e[r] = u, e[l] = n, r = l;
				else break a;
			}
		}
		return t;
	}
	function i(e, t) {
		var n = e.sortIndex - t.sortIndex;
		return n === 0 ? e.id - t.id : n;
	}
	if (e.unstable_now = void 0, typeof performance == "object" && typeof performance.now == "function") {
		var a = performance;
		e.unstable_now = function() {
			return a.now();
		};
	} else {
		var o = Date, s = o.now();
		e.unstable_now = function() {
			return o.now() - s;
		};
	}
	var c = [], l = [], u = 1, d = null, f = 3, p = !1, m = !1, h = !1, g = !1, _ = typeof setTimeout == "function" ? setTimeout : null, v = typeof clearTimeout == "function" ? clearTimeout : null, y = typeof setImmediate < "u" ? setImmediate : null;
	function b(e) {
		for (var i = n(l); i !== null;) {
			if (i.callback === null) r(l);
			else if (i.startTime <= e) r(l), i.sortIndex = i.expirationTime, t(c, i);
			else break;
			i = n(l);
		}
	}
	function x(e) {
		if (h = !1, b(e), !m) {
			if (n(c) !== null) m = !0, S || (S = !0, ne());
			else {
				var t = n(l);
				t !== null && ae(x, t.startTime - e);
			}
		}
	}
	var S = !1, C = -1, ee = 5, w = -1;
	function te() {
		return g ? !0 : !(e.unstable_now() - w < ee);
	}
	function T() {
		if (g = !1, S) {
			var t = e.unstable_now();
			w = t;
			var i = !0;
			try {
				a: {
					m = !1, h && (h = !1, v(C), C = -1), p = !0;
					var a = f;
					try {
						b: {
							for (b(t), d = n(c); d !== null && !(d.expirationTime > t && te());) {
								var o = d.callback;
								if (typeof o == "function") {
									d.callback = null, f = d.priorityLevel;
									var s = o(d.expirationTime <= t);
									if (t = e.unstable_now(), typeof s == "function") {
										d.callback = s, b(t), i = !0;
										break b;
									}
									d === n(c) && r(c), b(t);
								} else r(c);
								d = n(c);
							}
							if (d !== null) i = !0;
							else {
								var u = n(l);
								u !== null && ae(x, u.startTime - t), i = !1;
							}
						}
						break a;
					} finally {
						d = null, f = a, p = !1;
					}
					i = void 0;
				}
			} finally {
				i ? ne() : S = !1;
			}
		}
	}
	var ne;
	if (typeof y == "function") ne = function() {
		y(T);
	};
	else if (typeof MessageChannel < "u") {
		var re = new MessageChannel(), ie = re.port2;
		re.port1.onmessage = T, ne = function() {
			ie.postMessage(null);
		};
	} else ne = function() {
		_(T, 0);
	};
	function ae(t, n) {
		C = _(function() {
			t(e.unstable_now());
		}, n);
	}
	e.unstable_IdlePriority = 5, e.unstable_ImmediatePriority = 1, e.unstable_LowPriority = 4, e.unstable_NormalPriority = 3, e.unstable_Profiling = null, e.unstable_UserBlockingPriority = 2, e.unstable_cancelCallback = function(e) {
		e.callback = null;
	}, e.unstable_forceFrameRate = function(e) {
		0 > e || 125 < e ? console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported") : ee = 0 < e ? Math.floor(1e3 / e) : 5;
	}, e.unstable_getCurrentPriorityLevel = function() {
		return f;
	}, e.unstable_next = function(e) {
		switch (f) {
			case 1:
			case 2:
			case 3:
				var t = 3;
				break;
			default: t = f;
		}
		var n = f;
		f = t;
		try {
			return e();
		} finally {
			f = n;
		}
	}, e.unstable_requestPaint = function() {
		g = !0;
	}, e.unstable_runWithPriority = function(e, t) {
		switch (e) {
			case 1:
			case 2:
			case 3:
			case 4:
			case 5: break;
			default: e = 3;
		}
		var n = f;
		f = e;
		try {
			return t();
		} finally {
			f = n;
		}
	}, e.unstable_scheduleCallback = function(r, i, a) {
		var o = e.unstable_now();
		switch (typeof a == "object" && a ? (a = a.delay, a = typeof a == "number" && 0 < a ? o + a : o) : a = o, r) {
			case 1:
				var s = -1;
				break;
			case 2:
				s = 250;
				break;
			case 5:
				s = 1073741823;
				break;
			case 4:
				s = 1e4;
				break;
			default: s = 5e3;
		}
		return s = a + s, r = {
			id: u++,
			callback: i,
			priorityLevel: r,
			startTime: a,
			expirationTime: s,
			sortIndex: -1
		}, a > o ? (r.sortIndex = a, t(l, r), n(c) === null && r === n(l) && (h ? (v(C), C = -1) : h = !0, ae(x, a - o))) : (r.sortIndex = s, t(c, r), m || p || (m = !0, S || (S = !0, ne()))), r;
	}, e.unstable_shouldYield = te, e.unstable_wrapCallback = function(e) {
		var t = f;
		return function() {
			var n = f;
			f = t;
			try {
				return e.apply(this, arguments);
			} finally {
				f = n;
			}
		};
	};
})), f = /* @__PURE__ */ o(((e, t) => {
	t.exports = d();
})), p = /* @__PURE__ */ o(((e) => {
	var t = u();
	function n(e) {
		var t = "https://react.dev/errors/" + e;
		if (1 < arguments.length) {
			t += "?args[]=" + encodeURIComponent(arguments[1]);
			for (var n = 2; n < arguments.length; n++) t += "&args[]=" + encodeURIComponent(arguments[n]);
		}
		return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
	}
	function r() {}
	var i = {
		d: {
			f: r,
			r: function() {
				throw Error(n(522));
			},
			D: r,
			C: r,
			L: r,
			m: r,
			X: r,
			S: r,
			M: r
		},
		p: 0,
		findDOMNode: null
	}, a = Symbol.for("react.portal"), o = Symbol.for("react.recoverable"), s = Symbol.for("react.optimistic_key");
	function c(e, t, n) {
		var r = 3 < arguments.length && arguments[3] !== void 0 ? arguments[3] : null;
		return {
			$$typeof: a,
			key: r == null ? null : r === s ? s : "" + r,
			children: e,
			containerInfo: t,
			implementation: n
		};
	}
	var l = t.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
	function d(e, t) {
		if (e === "font") return "";
		if (typeof t == "string") return t === "use-credentials" ? t : "";
	}
	e.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = i, e.browser = function(e) {
		return {
			$$typeof: o,
			_reason: e
		};
	}, e.createPortal = function(e, t) {
		var r = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : null;
		if (!t || t.nodeType !== 1 && t.nodeType !== 9 && t.nodeType !== 11) throw Error(n(299));
		return c(e, t, null, r);
	}, e.flushSync = function(e) {
		var t = l.T, n = i.p;
		try {
			if (l.T = null, i.p = 2, e) return e();
		} finally {
			l.T = t, i.p = n, i.d.f();
		}
	}, e.preconnect = function(e, t) {
		typeof e == "string" && (t ? (t = t.crossOrigin, t = typeof t == "string" ? t === "use-credentials" ? t : "" : void 0) : t = null, i.d.C(e, t));
	}, e.prefetchDNS = function(e) {
		typeof e == "string" && i.d.D(e);
	}, e.preinit = function(e, t) {
		if (typeof e == "string" && t && typeof t.as == "string") {
			var n = t.as, r = d(n, t.crossOrigin), a = typeof t.integrity == "string" ? t.integrity : void 0, o = typeof t.fetchPriority == "string" ? t.fetchPriority : void 0;
			n === "style" ? i.d.S(e, typeof t.precedence == "string" ? t.precedence : void 0, {
				crossOrigin: r,
				integrity: a,
				fetchPriority: o
			}) : n === "script" && i.d.X(e, {
				crossOrigin: r,
				integrity: a,
				fetchPriority: o,
				nonce: typeof t.nonce == "string" ? t.nonce : void 0
			});
		}
	}, e.preinitModule = function(e, t) {
		if (typeof e == "string") {
			if (typeof t == "object" && t) {
				if (t.as == null || t.as === "script") {
					var n = d(t.as, t.crossOrigin);
					i.d.M(e, {
						crossOrigin: n,
						integrity: typeof t.integrity == "string" ? t.integrity : void 0,
						nonce: typeof t.nonce == "string" ? t.nonce : void 0,
						fetchPriority: typeof t.fetchPriority == "string" ? t.fetchPriority : void 0
					});
				}
			} else t ?? i.d.M(e);
		}
	}, e.preload = function(e, t) {
		if (typeof e == "string" && typeof t == "object" && t && typeof t.as == "string") {
			var n = t.as, r = d(n, t.crossOrigin);
			i.d.L(e, n, {
				crossOrigin: r,
				integrity: typeof t.integrity == "string" ? t.integrity : void 0,
				nonce: typeof t.nonce == "string" ? t.nonce : void 0,
				type: typeof t.type == "string" ? t.type : void 0,
				fetchPriority: typeof t.fetchPriority == "string" ? t.fetchPriority : void 0,
				referrerPolicy: typeof t.referrerPolicy == "string" ? t.referrerPolicy : void 0,
				imageSrcSet: typeof t.imageSrcSet == "string" ? t.imageSrcSet : void 0,
				imageSizes: typeof t.imageSizes == "string" ? t.imageSizes : void 0,
				media: typeof t.media == "string" ? t.media : void 0
			});
		}
	}, e.preloadModule = function(e, t) {
		if (typeof e == "string") {
			if (t) {
				var n = d(t.as, t.crossOrigin);
				i.d.m(e, {
					as: typeof t.as == "string" && t.as !== "script" ? t.as : void 0,
					crossOrigin: n,
					integrity: typeof t.integrity == "string" ? t.integrity : void 0,
					nonce: typeof t.nonce == "string" ? t.nonce : void 0,
					fetchPriority: typeof t.fetchPriority == "string" ? t.fetchPriority : void 0
				});
			} else i.d.m(e);
		}
	}, e.requestFormReset = function(e) {
		i.d.r(e);
	}, e.unstable_batchedUpdates = function(e, t) {
		return e(t);
	}, e.useFormState = function(e, t, n) {
		return l.H.useFormState(e, t, n);
	}, e.useFormStatus = function() {
		return l.H.useHostTransitionStatus();
	}, e.version = "19.3.1";
})), m = /* @__PURE__ */ o(((e, t) => {
	function n() {
		if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE == "function") try {
			__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
		} catch (e) {
			console.error(e);
		}
	}
	n(), t.exports = p();
})), h = /* @__PURE__ */ o(((e) => {
	var t = f(), n = u(), r = m();
	function i(e) {
		var t = "https://react.dev/errors/" + e;
		if (1 < arguments.length) {
			t += "?args[]=" + encodeURIComponent(arguments[1]);
			for (var n = 2; n < arguments.length; n++) t += "&args[]=" + encodeURIComponent(arguments[n]);
		}
		return "Minified React error #" + e + "; visit " + t + " for the full message or use the non-minified dev environment for full errors and additional helpful warnings.";
	}
	function a(e) {
		return !(!e || e.nodeType !== 1 && e.nodeType !== 9 && e.nodeType !== 11);
	}
	function o(e) {
		for (var t = e, n = t; n && !n.alternate;) t = n, t.flags & 4098 && (e = t.return), n = t.return;
		for (; t.return;) t = t.return;
		return t.tag === 3 ? e : null;
	}
	function s(e) {
		if (e.tag === 13) {
			var t = e.memoizedState;
			if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
		}
		return null;
	}
	function c(e) {
		if (e.tag === 31) {
			var t = e.memoizedState;
			if (t === null && (e = e.alternate, e !== null && (t = e.memoizedState)), t !== null) return t.dehydrated;
		}
		return null;
	}
	function l(e) {
		if (o(e) !== e) throw Error(i(188));
	}
	function d(e) {
		var t = e.alternate;
		if (!t) {
			if (t = o(e), t === null) throw Error(i(188));
			return t === e ? e : null;
		}
		for (var n = e, r = t;;) {
			var a = n.return;
			if (a === null) break;
			var s = a.alternate;
			if (s === null) {
				if (r = a.return, r !== null) {
					n = r;
					continue;
				}
				break;
			}
			if (a.child === s.child) {
				for (s = a.child; s;) {
					if (s === n) return l(a), e;
					if (s === r) return l(a), t;
					s = s.sibling;
				}
				throw Error(i(188));
			}
			if (n.return !== r.return) n = a, r = s;
			else {
				for (var c = !1, u = a.child; u;) {
					if (u === n) {
						c = !0, n = a, r = s;
						break;
					}
					if (u === r) {
						c = !0, r = a, n = s;
						break;
					}
					u = u.sibling;
				}
				if (!c) {
					for (u = s.child; u;) {
						if (u === n) {
							c = !0, n = s, r = a;
							break;
						}
						if (u === r) {
							c = !0, r = s, n = a;
							break;
						}
						u = u.sibling;
					}
					if (!c) throw Error(i(189));
				}
			}
			if (n.alternate !== r) throw Error(i(190));
		}
		if (n.tag !== 3) throw Error(i(188));
		return n.stateNode.current === n ? e : t;
	}
	function p(e) {
		var t = e.tag;
		if (t === 5 || t === 26 || t === 27 || t === 6) return e;
		for (e = e.child; e !== null;) {
			if (t = p(e), t !== null) return t;
			e = e.sibling;
		}
		return null;
	}
	function h(e, t, n, r, i, a) {
		for (; e !== null;) {
			if ((e.tag === 5 || e.tag === 27 || e.tag === 6) && n(e, r, i, a) || (e.tag !== 22 || e.memoizedState === null) && (t || e.tag !== 5 && e.tag !== 27) && h(e.child, t, n, r, i, a)) return !0;
			e = e.sibling;
		}
		return !1;
	}
	function g(e) {
		for (e = e.return; e !== null;) {
			if (e.tag === 3 || e.tag === 5 || e.tag === 27) return e;
			e = e.return;
		}
		return null;
	}
	function _(e) {
		var t = !1;
		for (e = e.return; e !== null && (e.tag === 4 && (t = !0), e.tag !== 3 && e.tag !== 5 && e.tag !== 27);) e = e.return;
		return t;
	}
	function v(e) {
		var t = [null, null], n = g(e);
		return n === null || y(t, e, n.child, { foundSelf: !1 }), t;
	}
	function y(e, t, n, r) {
		for (; n !== null;) {
			if (n === t) r.foundSelf = !0;
			else if (n.tag === 5 || n.tag === 27 || n.tag === 6) {
				if (r.foundSelf) return e[1] = n, !0;
				e[0] = n;
			} else if ((n.tag !== 22 || n.memoizedState === null) && y(e, t, n.child, r)) return !0;
			n = n.sibling;
		}
		return !1;
	}
	function b(e) {
		switch (e.tag) {
			case 5:
			case 27:
			case 6: return e.stateNode;
			case 3: return e.stateNode.containerInfo;
			default: throw Error(i(559));
		}
	}
	var x = null, S = null;
	function C(e, t, n) {
		return e === n || e === t && (x = e, !0);
	}
	function ee(e, t, n) {
		return e === n ? (S = e, !1) : e === t && (S !== null && (x = e), !0);
	}
	function w(e) {
		if (e === null) return null;
		do
			e = e === null ? null : e.return;
		while (e && e.tag !== 5 && e.tag !== 27 && e.tag !== 3);
		return e || null;
	}
	function te(e, t, n) {
		for (var r = 0, i = e; i; i = n(i)) r++;
		i = 0;
		for (var a = t; a; a = n(a)) i++;
		for (; 0 < r - i;) e = n(e), r--;
		for (; 0 < i - r;) t = n(t), i--;
		for (; r--;) {
			if (e === t || t !== null && e === t.alternate) return e;
			e = n(e), t = n(t);
		}
		return null;
	}
	var T = Object.assign, ne = Symbol.for("react.element"), re = Symbol.for("react.transitional.element"), ie = Symbol.for("react.portal"), ae = Symbol.for("react.fragment"), oe = Symbol.for("react.strict_mode"), se = Symbol.for("react.profiler"), ce = Symbol.for("react.consumer"), le = Symbol.for("react.context"), ue = Symbol.for("react.forward_ref"), de = Symbol.for("react.suspense"), fe = Symbol.for("react.suspense_list"), pe = Symbol.for("react.memo"), me = Symbol.for("react.lazy"), he = Symbol.for("react.activity"), ge = Symbol.for("react.legacy_hidden"), _e = Symbol.for("react.memo_cache_sentinel"), ve = Symbol.for("react.view_transition"), ye = Symbol.for("react.recoverable"), be = Symbol.iterator;
	function xe(e) {
		return typeof e != "object" || !e ? null : (e = be && e[be] || e["@@iterator"], typeof e == "function" ? e : null);
	}
	var Se = Symbol.for("react.client.reference");
	function Ce(e) {
		if (e == null) return null;
		if (typeof e == "function") return e.$$typeof === Se ? null : e.displayName || e.name || null;
		if (typeof e == "string") return e;
		switch (e) {
			case ae: return "Fragment";
			case se: return "Profiler";
			case oe: return "StrictMode";
			case de: return "Suspense";
			case fe: return "SuspenseList";
			case he: return "Activity";
			case ve: return "ViewTransition";
		}
		if (typeof e == "object") switch (e.$$typeof) {
			case ie: return "Portal";
			case le: return e.displayName || "Context";
			case ce: return (e._context.displayName || "Context") + ".Consumer";
			case ue:
				var t = e.render;
				return e = e.displayName, e ||= (e = t.displayName || t.name || "", e === "" ? "ForwardRef" : "ForwardRef(" + e + ")"), e;
			case pe: return t = e.displayName || null, t === null ? Ce(e.type) || "Memo" : t;
			case me:
				t = e._payload, e = e._init;
				try {
					return Ce(e(t));
				} catch {}
		}
		return null;
	}
	var we = Array.isArray, E = n.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, D = r.__DOM_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, O = {
		pending: !1,
		data: null,
		method: null,
		action: null
	}, Te = [], Ee = -1;
	function De(e) {
		return { current: e };
	}
	function k(e) {
		0 > Ee || (e.current = Te[Ee], Te[Ee] = null, Ee--);
	}
	function A(e, t) {
		Ee++, Te[Ee] = e.current, e.current = t;
	}
	var Oe = De(null), ke = De(null), Ae = De(null), je = De(null);
	function Me(e, t) {
		switch (A(Ae, t), A(ke, e), A(Oe, null), t.nodeType) {
			case 9:
			case 11:
				e = (e = t.documentElement) && (e = e.namespaceURI) ? up(e) : 0;
				break;
			default: if (e = t.tagName, t = t.namespaceURI) t = up(t), e = dp(t, e);
			else switch (e) {
				case "svg":
					e = 1;
					break;
				case "math":
					e = 2;
					break;
				default: e = 0;
			}
		}
		k(Oe), A(Oe, e);
	}
	function j() {
		k(Oe), k(ke), k(Ae);
	}
	function Ne(e) {
		var t = e.memoizedState;
		t !== null && (sh._currentValue = t.memoizedState, A(je, e)), t = Oe.current;
		var n = dp(t, e.type);
		t !== n && (A(ke, e), A(Oe, n));
	}
	function Pe(e) {
		ke.current === e && (k(Oe), k(ke)), je.current === e && (k(je), sh._currentValue = O);
	}
	var Fe, Ie;
	function Le(e) {
		if (Fe === void 0) try {
			throw Error();
		} catch (e) {
			var t = e.stack.trim().match(/\n( *(at )?)/);
			Fe = t && t[1] || "", Ie = -1 < e.stack.indexOf("\n    at") ? " (<anonymous>)" : -1 < e.stack.indexOf("@") ? "@unknown:0:0" : "";
		}
		return "\n" + Fe + e + Ie;
	}
	var Re = !1;
	function ze(e, t) {
		if (!e || Re) return "";
		Re = !0;
		var n = Error.prepareStackTrace;
		Error.prepareStackTrace = void 0;
		try {
			var r = { DetermineComponentFrameRoot: function() {
				try {
					if (t) {
						var n = function() {
							throw Error();
						};
						if (Object.defineProperty(n.prototype, "props", { set: function() {
							throw Error();
						} }), typeof Reflect == "object" && Reflect.construct) {
							try {
								Reflect.construct(n, []);
							} catch (e) {
								var r = e;
							}
							Reflect.construct(e, [], n);
						} else {
							try {
								n.call();
							} catch (e) {
								r = e;
							}
							n = !1;
							try {
								var i = Object.getOwnPropertyDescriptor(e.prototype, "props");
								Object.defineProperty(e.prototype, "props", {
									configurable: !0,
									set: function() {
										throw Error();
									}
								}), n = !0, new e();
							} finally {
								n && (i === void 0 ? delete e.prototype.props : Object.defineProperty(e.prototype, "props", i));
							}
						}
					} else {
						try {
							throw Error();
						} catch (e) {
							r = e;
						}
						(n = e()) && typeof n.catch == "function" && n.catch(function() {});
					}
				} catch (e) {
					if (e && r && typeof e.stack == "string") return [e.stack, r.stack];
				}
				return [null, null];
			} };
			r.DetermineComponentFrameRoot.displayName = "DetermineComponentFrameRoot";
			var i = Object.getOwnPropertyDescriptor(r.DetermineComponentFrameRoot, "name");
			i && i.configurable && Object.defineProperty(r.DetermineComponentFrameRoot, "name", { value: "DetermineComponentFrameRoot" });
			var a = r.DetermineComponentFrameRoot(), o = a[0], s = a[1];
			if (o && s) {
				var c = o.split("\n"), l = s.split("\n");
				for (i = r = 0; r < c.length && !c[r].includes("DetermineComponentFrameRoot");) r++;
				for (; i < l.length && !l[i].includes("DetermineComponentFrameRoot");) i++;
				if (r === c.length || i === l.length) for (r = c.length - 1, i = l.length - 1; 1 <= r && 0 <= i && c[r] !== l[i];) i--;
				for (; 1 <= r && 0 <= i; r--, i--) if (c[r] !== l[i]) {
					if (r !== 1 || i !== 1) do
						if (r--, i--, 0 > i || c[r] !== l[i]) {
							var u = "\n" + c[r].replace(" at new ", " at ");
							return e.displayName && u.includes("<anonymous>") && (u = u.replace("<anonymous>", e.displayName)), u;
						}
					while (1 <= r && 0 <= i);
					break;
				}
			}
		} finally {
			Re = !1, Error.prepareStackTrace = n;
		}
		return (n = e ? e.displayName || e.name : "") ? Le(n) : "";
	}
	function Be(e, t) {
		switch (e.tag) {
			case 26:
			case 27:
			case 5: return Le(e.type);
			case 16: return Le("Lazy");
			case 13: return e.child !== t && t !== null ? Le("Suspense Fallback") : Le("Suspense");
			case 19: return Le("SuspenseList");
			case 0:
			case 15: return ze(e.type, !1);
			case 11: return ze(e.type.render, !1);
			case 1: return ze(e.type, !0);
			case 31: return Le("Activity");
			case 30: return Le("ViewTransition");
			default: return "";
		}
	}
	function Ve(e) {
		try {
			var t = "", n = null;
			do
				t += Be(e, n), n = e, e = e.return;
			while (e);
			return t;
		} catch (e) {
			return "\nError generating stack: " + e.message + "\n" + e.stack;
		}
	}
	var He = Object.prototype.hasOwnProperty, Ue = t.unstable_scheduleCallback, We = t.unstable_cancelCallback, M = t.unstable_shouldYield, Ge = t.unstable_requestPaint, N = t.unstable_now, Ke = t.unstable_getCurrentPriorityLevel, qe = t.unstable_ImmediatePriority, Je = t.unstable_UserBlockingPriority, Ye = t.unstable_NormalPriority, Xe = t.unstable_LowPriority, Ze = t.unstable_IdlePriority, Qe = t.log, $e = t.unstable_setDisableYieldValue, et = null, P = null;
	function tt(e) {
		if (typeof Qe == "function" && $e(e), P && typeof P.setStrictMode == "function") try {
			P.setStrictMode(et, e);
		} catch {}
	}
	var nt = Math.clz32 ? Math.clz32 : at, rt = Math.log, it = Math.LN2;
	function at(e) {
		return e >>>= 0, e === 0 ? 32 : 31 - (rt(e) / it | 0) | 0;
	}
	var ot = 256, st = 262144, ct = 4194304;
	function lt(e) {
		var t = e & 42;
		if (t !== 0) return t;
		switch (e & -e) {
			case 1: return 1;
			case 2: return 2;
			case 4: return 4;
			case 8: return 8;
			case 16: return 16;
			case 32: return 32;
			case 64: return 64;
			case 128: return 128;
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072: return e & -e;
			case 262144:
			case 524288:
			case 1048576:
			case 2097152: return e & 3932160;
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432: return e & 62914560;
			case 67108864: return 67108864;
			case 134217728: return 134217728;
			case 268435456: return 268435456;
			case 536870912: return 536870912;
			case 1073741824: return 0;
			default: return e;
		}
	}
	function ut(e, t, n) {
		var r = e.pendingLanes;
		if (r === 0) return 0;
		var i = 0, a = e.suspendedLanes, o = e.pingedLanes;
		e = e.warmLanes;
		var s = r & 134217727;
		return s === 0 ? (s = r & ~a, s === 0 ? o === 0 ? n || (n = r & ~e, n !== 0 && (i = lt(n))) : i = lt(o) : i = lt(s)) : (r = s & ~a, r === 0 ? (o &= s, o === 0 ? n || (n = s & ~e, n !== 0 && (i = lt(n))) : i = lt(o)) : i = lt(r)), i === 0 ? 0 : t !== 0 && t !== i && (t & a) === 0 && (a = i & -i, n = t & -t, a >= n || a === 32 && n & 4194048) ? t : i;
	}
	function dt(e, t) {
		return (e.pendingLanes & ~(e.suspendedLanes & ~e.pingedLanes) & t) === 0;
	}
	function ft(e, t) {
		t & 8 && (t |= t & 32);
		var n = e.entangledLanes;
		if (n !== 0) for (e = e.entanglements, n &= t; 0 < n;) {
			var r = 31 - nt(n), i = 1 << r;
			t |= e[r], n &= ~i;
		}
		return t;
	}
	function pt(e, t) {
		switch (e) {
			case 1:
			case 2:
			case 4:
			case 8:
			case 64: return t + 250;
			case 16:
			case 32:
			case 128:
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072:
			case 262144:
			case 524288:
			case 1048576:
			case 2097152: return t + 5e3;
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432: return -1;
			case 67108864:
			case 134217728:
			case 268435456:
			case 536870912:
			case 1073741824: return -1;
			default: return -1;
		}
	}
	function mt() {
		var e = ct;
		return ct <<= 1, !(ct & 62914560) && (ct = 4194304), e;
	}
	function ht(e) {
		for (var t = [], n = 0; 31 > n; n++) t.push(e);
		return t;
	}
	function gt(e, t) {
		e.pendingLanes |= t, t !== 268435456 && (e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0);
	}
	function _t(e, t, n, r, i, a) {
		var o = e.pendingLanes;
		e.pendingLanes = n, e.suspendedLanes = 0, e.pingedLanes = 0, e.warmLanes = 0, e.expiredLanes &= n, e.entangledLanes &= n, e.errorRecoveryDisabledLanes &= n, e.shellSuspendCounter = 0;
		var s = e.entanglements, c = e.expirationTimes, l = e.hiddenUpdates;
		for (n = o & ~n; 0 < n;) {
			var u = 31 - nt(n), d = 1 << u;
			s[u] = 0, c[u] = -1;
			var f = l[u];
			if (f !== null) for (l[u] = null, u = 0; u < f.length; u++) {
				var p = f[u];
				p !== null && (p.lane &= -536870913);
			}
			n &= ~d;
		}
		r !== 0 && vt(e, r, 0), a !== 0 && i === 0 && e.tag !== 0 && (e.suspendedLanes |= a & ~(o & ~t));
	}
	function vt(e, t, n) {
		e.pendingLanes |= t, e.suspendedLanes &= ~t;
		var r = 31 - nt(t);
		e.entangledLanes |= t, e.entanglements[r] = e.entanglements[r] | 1073741824 | n & 261930;
	}
	function yt(e, t) {
		var n = e.entangledLanes |= t;
		for (e = e.entanglements; n;) {
			var r = 31 - nt(n), i = 1 << r;
			i & t | e[r] & t && (e[r] |= t), n &= ~i;
		}
	}
	function bt(e, t) {
		var n = t & -t;
		return n = n & 42 ? 1 : xt(n), (n & (e.suspendedLanes | t)) === 0 ? n : 0;
	}
	function xt(e) {
		switch (e) {
			case 2:
				e = 1;
				break;
			case 8:
				e = 4;
				break;
			case 32:
				e = 16;
				break;
			case 256:
			case 512:
			case 1024:
			case 2048:
			case 4096:
			case 8192:
			case 16384:
			case 32768:
			case 65536:
			case 131072:
			case 262144:
			case 524288:
			case 1048576:
			case 2097152:
			case 4194304:
			case 8388608:
			case 16777216:
			case 33554432:
				e = 128;
				break;
			case 268435456:
				e = 134217728;
				break;
			default: e = 0;
		}
		return e;
	}
	function St(e) {
		return e &= -e, 2 < e ? 8 < e ? e & 134217727 ? 32 : 268435456 : 8 : 2;
	}
	function Ct() {
		var e = D.p;
		return e === 0 ? (e = window.event, e === void 0 ? 32 : Ch(e.type)) : e;
	}
	function wt(e, t) {
		var n = D.p;
		try {
			return D.p = e, t();
		} finally {
			D.p = n;
		}
	}
	var Tt = Math.random().toString(36).slice(2), Et = "__reactFiber$" + Tt, Dt = "__reactProps$" + Tt, Ot = "__reactContainer$" + Tt, kt = "__reactEvents$" + Tt, At = "__reactListeners$" + Tt, jt = "__reactHandles$" + Tt, Mt = "__reactResources$" + Tt, Nt = "__reactMarker$" + Tt, Pt = "__reactLoad$" + Tt;
	function Ft(e) {
		delete e[Et], delete e[Dt], delete e[At], delete e[jt];
	}
	function It(e) {
		var t;
		if (t = e[Et]) return t;
		for (var n = e.parentNode; n;) {
			if (t = n[Ot] || n[Et]) {
				if (n = t.alternate, t.child !== null || n !== null && n.child !== null) for (e = fm(e); e !== null;) {
					if (n = e[Et]) return n;
					e = fm(e);
				}
				return t;
			}
			e = n, n = e.parentNode;
		}
		return null;
	}
	function Lt(e) {
		if (e = e[Et] || e[Ot]) {
			var t = e.tag;
			if (t === 5 || t === 6 || t === 13 || t === 31 || t === 26 || t === 27 || t === 3) return e;
		}
		return null;
	}
	function Rt(e) {
		var t = e.tag;
		if (t === 5 || t === 26 || t === 27 || t === 6) return e.stateNode;
		throw Error(i(33));
	}
	function zt(e) {
		var t = e[Mt];
		return t ||= e[Mt] = {
			hoistableStyles: /* @__PURE__ */ new Map(),
			hoistableScripts: /* @__PURE__ */ new Map()
		}, t;
	}
	function Bt(e) {
		e[Nt] = !0;
	}
	function Vt(e) {
		e[Pt] = void 0;
	}
	var Ht = /* @__PURE__ */ new Set(), Ut = {};
	function Wt(e, t) {
		Gt(e, t), Gt(e + "Capture", t);
	}
	function Gt(e, t) {
		for (Ut[e] = t, e = 0; e < t.length; e++) Ht.add(t[e]);
	}
	var Kt = RegExp("^[:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD][:A-Z_a-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u02FF\\u0370-\\u037D\\u037F-\\u1FFF\\u200C-\\u200D\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD\\-.0-9\\u00B7\\u0300-\\u036F\\u203F-\\u2040]*$"), qt = {}, Jt = {};
	function Yt(e) {
		return He.call(Jt, e) ? !0 : He.call(qt, e) ? !1 : Kt.test(e) ? Jt[e] = !0 : (qt[e] = !0, !1);
	}
	var F = !1;
	function Xt() {
		var e = F;
		return F = !1, e;
	}
	function Zt(e, t, n) {
		if (Yt(t)) {
			if (n === null) e.removeAttribute(t);
			else {
				switch (typeof n) {
					case "undefined":
					case "function":
					case "symbol":
						e.removeAttribute(t);
						return;
					case "boolean":
						var r = t.toLowerCase().slice(0, 5);
						if (r !== "data-" && r !== "aria-") {
							e.removeAttribute(t);
							return;
						}
				}
				e.setAttribute(t, n);
			}
		}
	}
	function Qt(e, t, n) {
		if (n === null) e.removeAttribute(t);
		else {
			switch (typeof n) {
				case "undefined":
				case "function":
				case "symbol":
				case "boolean":
					e.removeAttribute(t);
					return;
			}
			e.setAttribute(t, n);
		}
	}
	function $t(e, t, n, r) {
		if (r === null) e.removeAttribute(n);
		else {
			switch (typeof r) {
				case "undefined":
				case "function":
				case "symbol":
				case "boolean":
					e.removeAttribute(n);
					return;
			}
			e.setAttributeNS(t, n, r);
		}
	}
	function en(e) {
		switch (typeof e) {
			case "bigint":
			case "boolean":
			case "number":
			case "string":
			case "undefined": return e;
			case "object": return e;
			default: return "";
		}
	}
	function tn(e) {
		var t = e.type;
		return (e = e.nodeName) && e.toLowerCase() === "input" && (t === "checkbox" || t === "radio");
	}
	function nn(e, t, n) {
		var r = Object.getOwnPropertyDescriptor(e.constructor.prototype, t);
		if (!e.hasOwnProperty(t) && r !== void 0 && typeof r.get == "function" && typeof r.set == "function") {
			var i = r.get, a = r.set;
			return Object.defineProperty(e, t, {
				configurable: !0,
				get: function() {
					return i.call(this);
				},
				set: function(e) {
					n = "" + e, a.call(this, e);
				}
			}), Object.defineProperty(e, t, { enumerable: r.enumerable }), {
				getValue: function() {
					return n;
				},
				setValue: function(e) {
					n = "" + e;
				},
				stopTracking: function() {
					e._valueTracker = null, delete e[t];
				}
			};
		}
	}
	function rn(e) {
		if (!e._valueTracker) {
			var t = tn(e) ? "checked" : "value";
			e._valueTracker = nn(e, t, "" + e[t]);
		}
	}
	function an(e) {
		if (!e) return !1;
		var t = e._valueTracker;
		if (!t) return !0;
		var n = t.getValue(), r = "";
		return e && (r = tn(e) ? e.checked ? "true" : "false" : e.value), e = r, e !== n && (t.setValue(e), !0);
	}
	var on = /[\n"\\]/g;
	function sn(e) {
		return e.replace(on, function(e) {
			return "\\" + e.charCodeAt(0).toString(16) + " ";
		});
	}
	function cn(e, t, n, r, i, a, o, s) {
		e.name = "", o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" ? e.type = o : e.removeAttribute("type"), t == null ? o !== "submit" && o !== "reset" || e.removeAttribute("value") : o === "number" ? (t === 0 && e.value === "" || e.value != t) && (e.value = "" + en(t)) : e.value !== "" + en(t) && (e.value = "" + en(t)), t == null ? n == null ? r != null && e.removeAttribute("value") : un(e, en(n)) : o === "number" && e.value == t ? un(e, en(e.value)) : un(e, en(t)), i == null && a != null && (e.defaultChecked = !!a), i != null && (e.checked = i && typeof i != "function" && typeof i != "symbol"), s != null && typeof s != "function" && typeof s != "symbol" && typeof s != "boolean" ? e.name = "" + en(s) : e.removeAttribute("name");
	}
	function ln(e, t, n, r, i, a, o, s) {
		if (a != null && typeof a != "function" && typeof a != "symbol" && typeof a != "boolean" && (e.type = a), t != null || n != null) {
			if (!(a !== "submit" && a !== "reset" || t != null)) {
				rn(e);
				return;
			}
			n = n == null ? "" : "" + en(n), t = t == null ? n : "" + en(t), s || t === e.value || (e.value = t), e.defaultValue = t;
		}
		r ??= i, r = typeof r != "function" && typeof r != "symbol" && !!r, e.checked = s ? e.checked : !!r, e.defaultChecked = !!r, o != null && typeof o != "function" && typeof o != "symbol" && typeof o != "boolean" && (e.name = o), rn(e);
	}
	function un(e, t) {
		e.defaultValue !== "" + t && (e.defaultValue = "" + t);
	}
	function dn(e, t, n, r) {
		if (e = e.options, t) {
			t = {};
			for (var i = 0; i < n.length; i++) t["$" + n[i]] = !0;
			for (n = 0; n < e.length; n++) i = t.hasOwnProperty("$" + e[n].value), e[n].selected !== i && (e[n].selected = i), i && r && (e[n].defaultSelected = !0);
		} else {
			for (n = "" + en(n), t = null, i = 0; i < e.length; i++) {
				if (e[i].value === n) {
					e[i].selected = !0, r && (e[i].defaultSelected = !0);
					return;
				}
				t !== null || e[i].disabled || (t = e[i]);
			}
			t !== null && (t.selected = !0);
		}
	}
	function fn(e, t, n) {
		t != null && (t = "" + en(t), t !== e.value && (e.value = t), n == null) ? e.defaultValue !== t && (e.defaultValue = t) : e.defaultValue = n == null ? "" : "" + en(n);
	}
	function pn(e, t, n, r) {
		if (t == null) {
			if (r != null) {
				if (n != null) throw Error(i(92));
				if (we(r)) {
					if (1 < r.length) throw Error(i(93));
					r = r[0];
				}
				n = r;
			}
			n ??= "", t = n;
		}
		n = en(t), e.defaultValue = n, r = e.textContent, r === n && r !== "" && r !== null && (e.value = r), rn(e);
	}
	function mn(e, t) {
		if (t) {
			var n = e.firstChild;
			if (n && n === e.lastChild && n.nodeType === 3) {
				n.nodeValue = t;
				return;
			}
		}
		e.textContent = t;
	}
	var hn = new Set("animationIterationCount aspectRatio borderImageOutset borderImageSlice borderImageWidth boxFlex boxFlexGroup boxOrdinalGroup columnCount columns flex flexGrow flexPositive flexShrink flexNegative flexOrder gridArea gridRow gridRowEnd gridRowSpan gridRowStart gridColumn gridColumnEnd gridColumnSpan gridColumnStart fontWeight lineClamp lineHeight opacity order orphans scale tabSize widows zIndex zoom fillOpacity floodOpacity stopOpacity strokeDasharray strokeDashoffset strokeMiterlimit strokeOpacity strokeWidth MozAnimationIterationCount MozBoxFlex MozBoxFlexGroup MozLineClamp msAnimationIterationCount msFlex msZoom msFlexGrow msFlexNegative msFlexOrder msFlexPositive msFlexShrink msGridColumn msGridColumnSpan msGridRow msGridRowSpan WebkitAnimationIterationCount WebkitBoxFlex WebKitBoxFlexGroup WebkitBoxOrdinalGroup WebkitColumnCount WebkitColumns WebkitFlex WebkitFlexGrow WebkitFlexPositive WebkitFlexShrink WebkitLineClamp".split(" "));
	function gn(e, t, n) {
		var r = t.indexOf("--") === 0;
		n == null || typeof n == "boolean" || n === "" ? r ? e.setProperty(t, "") : t === "float" ? e.cssFloat = "" : e[t] = "" : r ? e.setProperty(t, n) : typeof n != "number" || n === 0 || hn.has(t) ? t === "float" ? e.cssFloat = n : e[t] = ("" + n).trim() : e[t] = n + "px";
	}
	function I(e, t, n) {
		if (t != null && typeof t != "object") throw Error(i(62));
		if (e = e.style, n != null) {
			for (var r in n) !n.hasOwnProperty(r) || t != null && t.hasOwnProperty(r) || (r.indexOf("--") === 0 ? e.setProperty(r, "") : r === "float" ? e.cssFloat = "" : e[r] = "", F = !0);
			for (var a in t) r = t[a], t.hasOwnProperty(a) && n[a] !== r && (gn(e, a, r), F = !0);
		} else for (var o in t) t.hasOwnProperty(o) && gn(e, o, t[o]);
	}
	function _n(e) {
		if (e.indexOf("-") === -1) return !1;
		switch (e) {
			case "annotation-xml":
			case "color-profile":
			case "font-face":
			case "font-face-src":
			case "font-face-uri":
			case "font-face-format":
			case "font-face-name":
			case "missing-glyph": return !1;
			default: return !0;
		}
	}
	var vn = /* @__PURE__ */ new Map([
		["acceptCharset", "accept-charset"],
		["htmlFor", "for"],
		["httpEquiv", "http-equiv"],
		["crossOrigin", "crossorigin"],
		["accentHeight", "accent-height"],
		["alignmentBaseline", "alignment-baseline"],
		["arabicForm", "arabic-form"],
		["baselineShift", "baseline-shift"],
		["capHeight", "cap-height"],
		["clipPath", "clip-path"],
		["clipRule", "clip-rule"],
		["colorInterpolation", "color-interpolation"],
		["colorInterpolationFilters", "color-interpolation-filters"],
		["colorProfile", "color-profile"],
		["colorRendering", "color-rendering"],
		["dominantBaseline", "dominant-baseline"],
		["enableBackground", "enable-background"],
		["fillOpacity", "fill-opacity"],
		["fillRule", "fill-rule"],
		["floodColor", "flood-color"],
		["floodOpacity", "flood-opacity"],
		["fontFamily", "font-family"],
		["fontSize", "font-size"],
		["fontSizeAdjust", "font-size-adjust"],
		["fontStretch", "font-stretch"],
		["fontStyle", "font-style"],
		["fontVariant", "font-variant"],
		["fontWeight", "font-weight"],
		["glyphName", "glyph-name"],
		["glyphOrientationHorizontal", "glyph-orientation-horizontal"],
		["glyphOrientationVertical", "glyph-orientation-vertical"],
		["horizAdvX", "horiz-adv-x"],
		["horizOriginX", "horiz-origin-x"],
		["imageRendering", "image-rendering"],
		["letterSpacing", "letter-spacing"],
		["lightingColor", "lighting-color"],
		["markerEnd", "marker-end"],
		["markerMid", "marker-mid"],
		["markerStart", "marker-start"],
		["maskType", "mask-type"],
		["overlinePosition", "overline-position"],
		["overlineThickness", "overline-thickness"],
		["paintOrder", "paint-order"],
		["panose-1", "panose-1"],
		["pointerEvents", "pointer-events"],
		["renderingIntent", "rendering-intent"],
		["shapeRendering", "shape-rendering"],
		["stopColor", "stop-color"],
		["stopOpacity", "stop-opacity"],
		["strikethroughPosition", "strikethrough-position"],
		["strikethroughThickness", "strikethrough-thickness"],
		["strokeDasharray", "stroke-dasharray"],
		["strokeDashoffset", "stroke-dashoffset"],
		["strokeLinecap", "stroke-linecap"],
		["strokeLinejoin", "stroke-linejoin"],
		["strokeMiterlimit", "stroke-miterlimit"],
		["strokeOpacity", "stroke-opacity"],
		["strokeWidth", "stroke-width"],
		["textAnchor", "text-anchor"],
		["textDecoration", "text-decoration"],
		["textRendering", "text-rendering"],
		["transformOrigin", "transform-origin"],
		["underlinePosition", "underline-position"],
		["underlineThickness", "underline-thickness"],
		["unicodeBidi", "unicode-bidi"],
		["unicodeRange", "unicode-range"],
		["unitsPerEm", "units-per-em"],
		["vAlphabetic", "v-alphabetic"],
		["vHanging", "v-hanging"],
		["vIdeographic", "v-ideographic"],
		["vMathematical", "v-mathematical"],
		["vectorEffect", "vector-effect"],
		["vertAdvY", "vert-adv-y"],
		["vertOriginX", "vert-origin-x"],
		["vertOriginY", "vert-origin-y"],
		["wordSpacing", "word-spacing"],
		["writingMode", "writing-mode"],
		["xmlnsXlink", "xmlns:xlink"],
		["xHeight", "x-height"]
	]), yn = /^[\u0000-\u001F ]*j[\r\n\t]*a[\r\n\t]*v[\r\n\t]*a[\r\n\t]*s[\r\n\t]*c[\r\n\t]*r[\r\n\t]*i[\r\n\t]*p[\r\n\t]*t[\r\n\t]*:/i;
	function L(e) {
		return yn.test("" + e) ? "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" : e;
	}
	function R() {}
	var bn = null;
	function z(e) {
		return e = e.target || e.srcElement || window, e.correspondingUseElement && (e = e.correspondingUseElement), e.nodeType === 3 ? e.parentNode : e;
	}
	var xn = null, B = null;
	function Sn(e) {
		var t = Lt(e);
		if (t && (e = t.stateNode)) {
			var n = e[Dt] || null;
			a: switch (e = t.stateNode, t.type) {
				case "input":
					if (cn(e, n.value, n.defaultValue, n.defaultValue, n.checked, n.defaultChecked, n.type, n.name), t = n.name, n.type === "radio" && t != null) {
						for (n = e; n.parentNode;) n = n.parentNode;
						for (n = n.querySelectorAll("input[name=\"" + sn("" + t) + "\"][type=\"radio\"]"), t = 0; t < n.length; t++) {
							var r = n[t];
							if (r !== e && r.form === e.form) {
								var a = r[Dt] || null;
								if (!a) throw Error(i(90));
								cn(r, a.value, a.defaultValue, a.defaultValue, a.checked, a.defaultChecked, a.type, a.name);
							}
						}
						for (t = 0; t < n.length; t++) r = n[t], r.form === e.form && an(r);
					}
					break a;
				case "textarea":
					fn(e, n.value, n.defaultValue);
					break a;
				case "select": t = n.value, t != null && dn(e, !!n.multiple, t, !1);
			}
		}
	}
	var Cn = !1;
	function wn(e, t, n) {
		if (Cn) return e(t, n);
		Cn = !0;
		try {
			return e(t);
		} finally {
			if (Cn = !1, (xn !== null || B !== null) && (zd(), xn && (t = xn, e = B, B = xn = null, Sn(t), e))) for (t = 0; t < e.length; t++) Sn(e[t]);
		}
	}
	function Tn(e, t) {
		var n = e.stateNode;
		if (n === null) return null;
		var r = n[Dt] || null;
		if (r === null) return null;
		n = r[t];
		a: switch (t) {
			case "onClick":
			case "onClickCapture":
			case "onDoubleClick":
			case "onDoubleClickCapture":
			case "onMouseDown":
			case "onMouseDownCapture":
			case "onMouseMove":
			case "onMouseMoveCapture":
			case "onMouseUp":
			case "onMouseUpCapture":
			case "onMouseEnter":
				(r = !r.disabled) || (e = e.type, r = e !== "button" && e !== "input" && e !== "select" && e !== "textarea"), e = !r;
				break a;
			default: e = !1;
		}
		if (e) return null;
		if (n && typeof n != "function") throw Error(i(231, t, typeof n));
		return n;
	}
	var En = typeof window < "u" && window.document !== void 0 && window.document.createElement !== void 0, Dn = !1;
	if (En) try {
		var On = {};
		Object.defineProperty(On, "passive", { get: function() {
			Dn = !0;
		} }), window.addEventListener("test", On, On), window.removeEventListener("test", On, On);
	} catch {
		Dn = !1;
	}
	var kn = null, An = null, jn = null;
	function Mn() {
		if (jn) return jn;
		var e, t = An, n = t.length, r, i = "value" in kn ? kn.value : kn.textContent, a = i.length;
		for (e = 0; e < n && t[e] === i[e]; e++);
		var o = n - e;
		for (r = 1; r <= o && t[n - r] === i[a - r]; r++);
		return jn = i.slice(e, 1 < r ? 1 - r : void 0);
	}
	function Nn(e) {
		var t = e.keyCode;
		return "charCode" in e ? (e = e.charCode, e === 0 && t === 13 && (e = 13)) : e = t, e === 10 && (e = 13), 32 <= e || e === 13 ? e : 0;
	}
	function Pn() {
		return !0;
	}
	function Fn() {
		return !1;
	}
	function In(e) {
		function t(t, n, r, i, a) {
			for (var o in this._reactName = t, this._targetInst = r, this.type = n, this.nativeEvent = i, this.target = a, this.currentTarget = null, e) e.hasOwnProperty(o) && (t = e[o], this[o] = t ? t(i) : i[o]);
			return this.isDefaultPrevented = (i.defaultPrevented == null ? !1 === i.returnValue : i.defaultPrevented) ? Pn : Fn, this.isPropagationStopped = Fn, this;
		}
		return T(t.prototype, {
			preventDefault: function() {
				this.defaultPrevented = !0;
				var e = this.nativeEvent;
				e && (e.preventDefault ? e.preventDefault() : typeof e.returnValue != "unknown" && (e.returnValue = !1), this.isDefaultPrevented = Pn);
			},
			stopPropagation: function() {
				var e = this.nativeEvent;
				e && (e.stopPropagation ? e.stopPropagation() : typeof e.cancelBubble != "unknown" && (e.cancelBubble = !0), this.isPropagationStopped = Pn);
			},
			persist: function() {},
			isPersistent: Pn
		}), t;
	}
	var Ln = {
		eventPhase: 0,
		bubbles: 0,
		cancelable: 0,
		timeStamp: function(e) {
			return e.timeStamp || Date.now();
		},
		defaultPrevented: 0,
		isTrusted: 0
	}, Rn = In(Ln), zn = T({}, Ln, {
		view: 0,
		detail: 0
	}), Bn = In(zn), Vn, Hn, Un, Wn = T({}, zn, {
		screenX: 0,
		screenY: 0,
		clientX: 0,
		clientY: 0,
		pageX: 0,
		pageY: 0,
		ctrlKey: 0,
		shiftKey: 0,
		altKey: 0,
		metaKey: 0,
		getModifierState: er,
		button: 0,
		buttons: 0,
		relatedTarget: function(e) {
			return e.relatedTarget === void 0 ? e.fromElement === e.srcElement ? e.toElement : e.fromElement : e.relatedTarget;
		},
		movementX: function(e) {
			return "movementX" in e ? e.movementX : (e !== Un && (Un && e.type === "mousemove" ? (Vn = e.screenX - Un.screenX, Hn = e.screenY - Un.screenY) : Hn = Vn = 0, Un = e), Vn);
		},
		movementY: function(e) {
			return "movementY" in e ? e.movementY : Hn;
		}
	}), Gn = In(Wn), V = In(T({}, Wn, { dataTransfer: 0 })), Kn = In(T({}, zn, { relatedTarget: 0 })), qn = In(T({}, Ln, {
		animationName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), Jn = In(T({}, Ln, { clipboardData: function(e) {
		return "clipboardData" in e ? e.clipboardData : window.clipboardData;
	} })), Yn = In(T({}, Ln, { data: 0 })), Xn = {
		Esc: "Escape",
		Spacebar: " ",
		Left: "ArrowLeft",
		Up: "ArrowUp",
		Right: "ArrowRight",
		Down: "ArrowDown",
		Del: "Delete",
		Win: "OS",
		Menu: "ContextMenu",
		Apps: "ContextMenu",
		Scroll: "ScrollLock",
		MozPrintableKey: "Unidentified"
	}, Zn = {
		8: "Backspace",
		9: "Tab",
		12: "Clear",
		13: "Enter",
		16: "Shift",
		17: "Control",
		18: "Alt",
		19: "Pause",
		20: "CapsLock",
		27: "Escape",
		32: " ",
		33: "PageUp",
		34: "PageDown",
		35: "End",
		36: "Home",
		37: "ArrowLeft",
		38: "ArrowUp",
		39: "ArrowRight",
		40: "ArrowDown",
		45: "Insert",
		46: "Delete",
		112: "F1",
		113: "F2",
		114: "F3",
		115: "F4",
		116: "F5",
		117: "F6",
		118: "F7",
		119: "F8",
		120: "F9",
		121: "F10",
		122: "F11",
		123: "F12",
		144: "NumLock",
		145: "ScrollLock",
		224: "Meta"
	}, Qn = {
		Alt: "altKey",
		Control: "ctrlKey",
		Meta: "metaKey",
		Shift: "shiftKey"
	};
	function $n(e) {
		var t = this.nativeEvent;
		return t.getModifierState ? t.getModifierState(e) : (e = Qn[e]) ? !!t[e] : !1;
	}
	function er() {
		return $n;
	}
	var tr = In(T({}, zn, {
		key: function(e) {
			if (e.key) {
				var t = Xn[e.key] || e.key;
				if (t !== "Unidentified") return t;
			}
			return e.type === "keypress" ? (e = Nn(e), e === 13 ? "Enter" : String.fromCharCode(e)) : e.type === "keydown" || e.type === "keyup" ? Zn[e.keyCode] || "Unidentified" : "";
		},
		code: 0,
		location: 0,
		ctrlKey: 0,
		shiftKey: 0,
		altKey: 0,
		metaKey: 0,
		repeat: 0,
		locale: 0,
		getModifierState: er,
		charCode: function(e) {
			return e.type === "keypress" ? Nn(e) : 0;
		},
		keyCode: function(e) {
			return e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
		},
		which: function(e) {
			return e.type === "keypress" ? Nn(e) : e.type === "keydown" || e.type === "keyup" ? e.keyCode : 0;
		}
	})), nr = In(T({}, Wn, {
		pointerId: 0,
		width: 0,
		height: 0,
		pressure: 0,
		tangentialPressure: 0,
		tiltX: 0,
		tiltY: 0,
		twist: 0,
		pointerType: 0,
		isPrimary: 0
	})), rr = In(T({}, Ln, { submitter: 0 })), ir = In(T({}, zn, {
		touches: 0,
		targetTouches: 0,
		changedTouches: 0,
		altKey: 0,
		metaKey: 0,
		ctrlKey: 0,
		shiftKey: 0,
		getModifierState: er
	})), ar = In(T({}, Ln, {
		propertyName: 0,
		elapsedTime: 0,
		pseudoElement: 0
	})), or = In(T({}, Wn, {
		deltaX: function(e) {
			return "deltaX" in e ? e.deltaX : "wheelDeltaX" in e ? -e.wheelDeltaX : 0;
		},
		deltaY: function(e) {
			return "deltaY" in e ? e.deltaY : "wheelDeltaY" in e ? -e.wheelDeltaY : "wheelDelta" in e ? -e.wheelDelta : 0;
		},
		deltaZ: 0,
		deltaMode: 0
	})), sr = In(T({}, Ln, {
		newState: 0,
		oldState: 0,
		source: 0
	})), cr = [
		9,
		13,
		27,
		32
	], lr = En && "CompositionEvent" in window, ur = null;
	En && "documentMode" in document && (ur = document.documentMode);
	var dr = En && "TextEvent" in window && !ur, fr = En && (!lr || ur && 8 < ur && 11 >= ur), pr = " ", mr = !1;
	function hr(e, t) {
		switch (e) {
			case "keyup": return cr.indexOf(t.keyCode) !== -1;
			case "keydown": return t.keyCode !== 229;
			case "keypress":
			case "mousedown":
			case "focusout": return !0;
			default: return !1;
		}
	}
	function gr(e) {
		return e = e.detail, typeof e == "object" && "data" in e ? e.data : null;
	}
	var _r = !1;
	function vr(e, t) {
		switch (e) {
			case "compositionend": return gr(t);
			case "keypress": return t.which === 32 ? (mr = !0, pr) : null;
			case "textInput": return e = t.data, e === pr && mr ? null : e;
			default: return null;
		}
	}
	function yr(e, t) {
		if (_r) return e === "compositionend" || !lr && hr(e, t) ? (e = Mn(), jn = An = kn = null, _r = !1, e) : null;
		switch (e) {
			case "paste": return null;
			case "keypress":
				if (!(t.ctrlKey || t.altKey || t.metaKey) || t.ctrlKey && t.altKey) {
					if (t.char && 1 < t.char.length) return t.char;
					if (t.which) return String.fromCharCode(t.which);
				}
				return null;
			case "compositionend": return fr && t.locale !== "ko" ? null : t.data;
			default: return null;
		}
	}
	var br = {
		color: !0,
		date: !0,
		datetime: !0,
		"datetime-local": !0,
		email: !0,
		month: !0,
		number: !0,
		password: !0,
		range: !0,
		search: !0,
		tel: !0,
		text: !0,
		time: !0,
		url: !0,
		week: !0
	};
	function xr(e) {
		var t = e && e.nodeName && e.nodeName.toLowerCase();
		return t === "input" ? !!br[e.type] : t === "textarea";
	}
	function Sr(e, t, n, r) {
		xn ? B ? B.push(r) : B = [r] : xn = r, t = Jf(t, "onChange"), 0 < t.length && (n = new Rn("onChange", "change", null, n, r), e.push({
			event: n,
			listeners: t
		}));
	}
	var Cr = null, wr = null;
	function Tr(e) {
		Vf(e, 0);
	}
	function Er(e) {
		if (an(Rt(e))) return e;
	}
	function Dr(e, t) {
		if (e === "change") return t;
	}
	var Or = !1;
	if (En) {
		var kr;
		if (En) {
			var Ar = "oninput" in document;
			if (!Ar) {
				var jr = document.createElement("div");
				jr.setAttribute("oninput", "return;"), Ar = typeof jr.oninput == "function";
			}
			kr = Ar;
		} else kr = !1;
		Or = kr && (!document.documentMode || 9 < document.documentMode);
	}
	function Mr() {
		Cr && (Cr.detachEvent("onpropertychange", Nr), wr = Cr = null);
	}
	function Nr(e) {
		if (e.propertyName === "value" && Er(wr)) {
			var t = [];
			Sr(t, wr, e, z(e)), wn(Tr, t);
		}
	}
	function Pr(e, t, n) {
		e === "focusin" ? (Mr(), Cr = t, wr = n, Cr.attachEvent("onpropertychange", Nr)) : e === "focusout" && Mr();
	}
	function Fr(e) {
		if (e === "selectionchange" || e === "keyup" || e === "keydown") return Er(wr);
	}
	function Ir(e, t) {
		if (e === "click") return Er(t);
	}
	function Lr(e, t) {
		if (e === "input" || e === "change") return Er(t);
	}
	function Rr(e, t) {
		return e === t && (e !== 0 || 1 / e == 1 / t) || e !== e && t !== t;
	}
	var zr = typeof Object.is == "function" ? Object.is : Rr;
	function Br(e, t) {
		if (zr(e, t)) return !0;
		if (typeof e != "object" || !e || typeof t != "object" || !t) return !1;
		var n = Object.keys(e), r = Object.keys(t);
		if (n.length !== r.length) return !1;
		for (r = 0; r < n.length; r++) {
			var i = n[r];
			if (!He.call(t, i) || !zr(e[i], t[i])) return !1;
		}
		return !0;
	}
	function Vr(e) {
		if (e ||= typeof document < "u" ? document : void 0, e === void 0) return null;
		try {
			return e.activeElement || e.body;
		} catch {
			return e.body;
		}
	}
	function Hr(e) {
		for (; e && e.firstChild;) e = e.firstChild;
		return e;
	}
	function Ur(e, t) {
		var n = Hr(e);
		e = 0;
		for (var r; n;) {
			if (n.nodeType === 3) {
				if (r = e + n.textContent.length, e <= t && r >= t) return {
					node: n,
					offset: t - e
				};
				e = r;
			}
			a: {
				for (; n;) {
					if (n.nextSibling) {
						n = n.nextSibling;
						break a;
					}
					n = n.parentNode;
				}
				n = void 0;
			}
			n = Hr(n);
		}
	}
	function Wr(e, t) {
		return e && t ? e === t ? !0 : e && e.nodeType === 3 ? !1 : t && t.nodeType === 3 ? Wr(e, t.parentNode) : "contains" in e ? e.contains(t) : e.compareDocumentPosition ? !!(e.compareDocumentPosition(t) & 16) : !1 : !1;
	}
	function Gr(e) {
		e = e != null && e.ownerDocument != null && e.ownerDocument.defaultView != null ? e.ownerDocument.defaultView : window;
		for (var t = Vr(e.document); t instanceof e.HTMLIFrameElement;) {
			try {
				var n = typeof t.contentWindow.location.href == "string";
			} catch {
				n = !1;
			}
			if (n) e = t.contentWindow;
			else break;
			t = Vr(e.document);
		}
		return t;
	}
	function Kr(e) {
		var t = e && e.nodeName && e.nodeName.toLowerCase();
		return t && (t === "input" && (e.type === "text" || e.type === "search" || e.type === "tel" || e.type === "url" || e.type === "password") || t === "textarea" || e.contentEditable === "true");
	}
	var qr = En && "documentMode" in document && 11 >= document.documentMode, Jr = null, Yr = null, Xr = null, Zr = !1;
	function Qr(e, t, n) {
		var r = n.window === n ? n.document : n.nodeType === 9 ? n : n.ownerDocument;
		Zr || Jr == null || Jr !== Vr(r) || (r = Jr, "selectionStart" in r && Kr(r) ? r = {
			start: r.selectionStart,
			end: r.selectionEnd
		} : (r = (r.ownerDocument && r.ownerDocument.defaultView || window).getSelection(), r = {
			anchorNode: r.anchorNode,
			anchorOffset: r.anchorOffset,
			focusNode: r.focusNode,
			focusOffset: r.focusOffset
		}), Xr && Br(Xr, r) || (Xr = r, r = Jf(Yr, "onSelect"), 0 < r.length && (t = new Rn("onSelect", "select", null, t, n), e.push({
			event: t,
			listeners: r
		}), t.target = Jr)));
	}
	function $r(e, t) {
		var n = {};
		return n[e.toLowerCase()] = t.toLowerCase(), n["Webkit" + e] = "webkit" + t, n["Moz" + e] = "moz" + t, n;
	}
	var ei = {
		animationend: $r("Animation", "AnimationEnd"),
		animationiteration: $r("Animation", "AnimationIteration"),
		animationstart: $r("Animation", "AnimationStart"),
		transitionrun: $r("Transition", "TransitionRun"),
		transitionstart: $r("Transition", "TransitionStart"),
		transitioncancel: $r("Transition", "TransitionCancel"),
		transitionend: $r("Transition", "TransitionEnd")
	}, ti = {}, ni = {};
	En && (ni = document.createElement("div").style, "AnimationEvent" in window || (delete ei.animationend.animation, delete ei.animationiteration.animation, delete ei.animationstart.animation), "TransitionEvent" in window || delete ei.transitionend.transition);
	function ri(e) {
		if (ti[e]) return ti[e];
		if (!ei[e]) return e;
		var t = ei[e], n;
		for (n in t) if (t.hasOwnProperty(n) && n in ni) return ti[e] = t[n];
		return e;
	}
	var ii = ri("animationend"), ai = ri("animationiteration"), oi = ri("animationstart"), si = ri("transitionrun"), ci = ri("transitionstart"), li = ri("transitioncancel"), ui = ri("transitionend"), di = /* @__PURE__ */ new Map(), fi = "abort auxClick beforeToggle cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error fullscreenChange fullscreenError gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");
	fi.push("scrollEnd");
	function pi(e, t) {
		di.set(e, t), Wt(t, [e]);
	}
	var mi = 0;
	function hi(e, t) {
		if (e.name != null && e.name !== "auto") return e.name;
		if (t.autoName !== null) return t.autoName;
		e = bd.identifierPrefix;
		var n = mi++;
		return e = "_" + e + "t_" + n.toString(32) + "_", t.autoName = e;
	}
	function gi(e) {
		if (e == null || typeof e == "string") return e;
		var t = null, n = Od;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var i = e[n[r]];
			if (i != null) {
				if (i === "none") return "none";
				t = t == null ? i : t + (" " + i);
			}
		}
		return t ?? e.default;
	}
	function _i(e, t) {
		return e = gi(e), t = gi(t), t == null ? e === "auto" ? null : e : t === "auto" ? null : t;
	}
	var vi = typeof reportError == "function" ? reportError : function(e) {
		if (typeof window == "object" && typeof window.ErrorEvent == "function") {
			var t = new window.ErrorEvent("error", {
				bubbles: !0,
				cancelable: !0,
				message: typeof e == "object" && e && typeof e.message == "string" ? String(e.message) : String(e),
				error: e
			});
			if (!window.dispatchEvent(t)) return;
		} else if (typeof process == "object" && typeof process.emit == "function") {
			process.emit("uncaughtException", e);
			return;
		}
		console.error(e);
	}, yi = [], bi = 0, xi = 0;
	function Si() {
		for (var e = bi, t = xi = bi = 0; t < e;) {
			var n = yi[t];
			yi[t++] = null;
			var r = yi[t];
			yi[t++] = null;
			var i = yi[t];
			yi[t++] = null;
			var a = yi[t];
			if (yi[t++] = null, r !== null && i !== null) {
				var o = r.pending;
				o === null ? i.next = i : (i.next = o.next, o.next = i), r.pending = i;
			}
			a !== 0 && Ei(n, i, a);
		}
	}
	function Ci(e, t, n, r) {
		yi[bi++] = e, yi[bi++] = t, yi[bi++] = n, yi[bi++] = r, xi |= r, e.lanes |= r, e = e.alternate, e !== null && (e.lanes |= r);
	}
	function wi(e, t, n, r) {
		return Ci(e, t, n, r), Di(e);
	}
	function Ti(e, t) {
		return Ci(e, null, null, t), Di(e);
	}
	function Ei(e, t, n) {
		e.lanes |= n;
		var r = e.alternate;
		r !== null && (r.lanes |= n);
		for (var i = !1, a = e.return; a !== null;) a.childLanes |= n, r = a.alternate, r !== null && (r.childLanes |= n), a.tag === 22 && (e = a.stateNode, e === null || e._visibility & 1 || (i = !0)), e = a, a = a.return;
		return e.tag === 3 ? (a = e.stateNode, i && t !== null && (i = 31 - nt(n), e = a.hiddenUpdates, r = e[i], r === null ? e[i] = [t] : r.push(t), t.lane = n | 536870912), a) : null;
	}
	function Di(e) {
		if (50 < kd) throw kd = 0, Ad = null, Error(i(185));
		for (var t = e.return; t !== null;) e = t, t = e.return;
		return e.tag === 3 ? e.stateNode : null;
	}
	var Oi = {};
	function ki(e, t, n, r) {
		this.tag = e, this.key = n, this.sibling = this.child = this.return = this.stateNode = this.type = this.elementType = null, this.index = 0, this.refCleanup = this.ref = null, this.pendingProps = t, this.dependencies = this.memoizedState = this.updateQueue = this.memoizedProps = null, this.mode = r, this.subtreeFlags = this.flags = 0, this.deletions = null, this.childLanes = this.lanes = 0, this.alternate = null;
	}
	function Ai(e, t, n, r) {
		return new ki(e, t, n, r);
	}
	function ji(e) {
		return e = e.prototype, !(!e || !e.isReactComponent);
	}
	function Mi(e, t) {
		var n = e.alternate;
		return n === null ? (n = Ai(e.tag, t, e.key, e.mode), n.elementType = e.elementType, n.type = e.type, n.stateNode = e.stateNode, n.alternate = e, e.alternate = n) : (n.pendingProps = t, n.type = e.type, n.flags = 0, n.subtreeFlags = 0, n.deletions = null), n.flags = e.flags & 1206910976, n.childLanes = e.childLanes, n.lanes = e.lanes, n.child = e.child, n.memoizedProps = e.memoizedProps, n.memoizedState = e.memoizedState, n.updateQueue = e.updateQueue, t = e.dependencies, n.dependencies = t === null ? null : {
			lanes: t.lanes,
			firstContext: t.firstContext
		}, n.sibling = e.sibling, n.index = e.index, n.ref = e.ref, n.refCleanup = e.refCleanup, n;
	}
	function Ni(e, t) {
		e.flags &= 1206910978;
		var n = e.alternate;
		return n === null ? (e.childLanes = 0, e.lanes = t, e.child = null, e.subtreeFlags = 0, e.memoizedProps = null, e.memoizedState = null, e.updateQueue = null, e.dependencies = null, e.stateNode = null) : (e.childLanes = n.childLanes, e.lanes = n.lanes, e.child = n.child, e.subtreeFlags = 0, e.deletions = null, e.memoizedProps = n.memoizedProps, e.memoizedState = n.memoizedState, e.updateQueue = n.updateQueue, e.type = n.type, t = n.dependencies, e.dependencies = t === null ? null : {
			lanes: t.lanes,
			firstContext: t.firstContext
		}), e;
	}
	function Pi(e, t, n, r, a, o) {
		var s = 0;
		if (r = e, typeof r == "function") ji(r) && (s = 1);
		else if (typeof r == "string") s = qm(e, n, Oe.current) ? 26 : e === "html" || e === "head" || e === "body" ? 27 : 5;
		else a: switch (r) {
			case he: return e = Ai(31, n, t, a), e.elementType = he, e.lanes = o, e;
			case ae: return Fi(n.children, a, o, t);
			case oe:
				s = 8, a |= 24;
				break;
			case se: return e = Ai(12, n, t, a | 2), e.elementType = se, e.lanes = o, e;
			case de: return e = Ai(13, n, t, a), e.elementType = de, e.lanes = o, e;
			case fe: return e = Ai(19, n, t, a), e.elementType = fe, e.lanes = o, e;
			case ge:
			case ve: return e = a | 32, e = Ai(30, n, t, e), e.elementType = ve, e.lanes = o, e.stateNode = {
				autoName: null,
				paired: null,
				clones: null,
				ref: null
			}, e;
			default:
				if (typeof r == "object" && r) switch (r.$$typeof) {
					case le:
						s = 10;
						break a;
					case ce:
						s = 9;
						break a;
					case ue:
						s = 11;
						break a;
					case pe:
						s = 14;
						break a;
					case me:
						s = 16, r = null;
						break a;
				}
				s = 29, n = Error(i(130, e === null ? "null" : typeof e, "")), r = null;
		}
		return t = Ai(s, n, t, a), t.elementType = e, t.type = r, t.lanes = o, t;
	}
	function Fi(e, t, n, r) {
		return e = Ai(7, e, r, t), e.lanes = n, e;
	}
	function Ii(e, t, n) {
		return e = Ai(6, e, null, t), e.lanes = n, e;
	}
	function Li(e) {
		var t = Ai(18, null, null, 0);
		return t.stateNode = e, t;
	}
	function Ri(e, t, n) {
		return t = Ai(4, e.children === null ? [] : e.children, e.key, t), t.lanes = n, t.stateNode = {
			containerInfo: e.containerInfo,
			pendingChildren: null,
			implementation: e.implementation
		}, t;
	}
	var zi = /* @__PURE__ */ new WeakMap();
	function Bi(e, t) {
		if (typeof e == "object" && e) {
			var n = zi.get(e);
			return n === void 0 ? (t = {
				value: e,
				source: t,
				stack: Ve(t)
			}, zi.set(e, t), t) : n;
		}
		return {
			value: e,
			source: t,
			stack: Ve(t)
		};
	}
	var Vi = [], Hi = 0, Ui = null, Wi = 0, Gi = [], Ki = 0, qi = null, Ji = 1, Yi = "";
	function Xi(e, t) {
		Vi[Hi++] = Wi, Vi[Hi++] = Ui, Ui = e, Wi = t;
	}
	function Zi(e, t, n) {
		Gi[Ki++] = Ji, Gi[Ki++] = Yi, Gi[Ki++] = qi, qi = e;
		var r = Ji;
		e = Yi;
		var i = 32 - nt(r) - 1;
		r &= ~(1 << i), n += 1;
		var a = 32 - nt(t) + i;
		if (30 < a) {
			var o = i - i % 5;
			a = (r & (1 << o) - 1).toString(32), r >>= o, i -= o, Ji = 1 << 32 - nt(t) + i | n << i | r, Yi = a + e;
		} else Ji = 1 << a | n << i | r, Yi = e;
	}
	function Qi(e) {
		e.return !== null && (Xi(e, 1), Zi(e, 1, 0));
	}
	function $i(e) {
		for (; e === Ui;) Ui = Vi[--Hi], Vi[Hi] = null, Wi = Vi[--Hi], Vi[Hi] = null;
		for (; e === qi;) qi = Gi[--Ki], Gi[Ki] = null, Yi = Gi[--Ki], Gi[Ki] = null, Ji = Gi[--Ki], Gi[Ki] = null;
	}
	function ea(e, t) {
		Gi[Ki++] = Ji, Gi[Ki++] = Yi, Gi[Ki++] = qi, Ji = t.id, Yi = t.overflow, qi = e;
	}
	var ta = null, H = null, U = !1, na = null, ra = !1, ia = Error(i(519));
	function aa(e) {
		throw da(Bi(Error(i(418, 1 < arguments.length && arguments[1] !== void 0 && arguments[1] ? "text" : "HTML", "")), e)), ia;
	}
	function oa(e) {
		var t = e.stateNode, n = e.type, r = e.memoizedProps;
		switch (t[Et] = e, t[Dt] = r, n) {
			case "dialog":
				Q("cancel", t), Q("close", t);
				break;
			case "iframe":
			case "object":
			case "embed":
				Q("load", t);
				break;
			case "video":
			case "audio":
				for (n = 0; n < zf.length; n++) Q(zf[n], t);
				break;
			case "source":
				Q("error", t);
				break;
			case "img":
			case "image":
			case "link":
				Q("error", t), Q("load", t);
				break;
			case "details":
				Q("toggle", t);
				break;
			case "input":
				Q("invalid", t), ln(t, r.value, r.defaultValue, r.checked, r.defaultChecked, r.type, r.name, !0);
				break;
			case "select":
				Q("invalid", t);
				break;
			case "textarea": Q("invalid", t), pn(t, r.value, r.defaultValue, r.children);
		}
		n = r.children, typeof n != "string" && typeof n != "number" && typeof n != "bigint" || t.textContent === "" + n || !0 === r.suppressHydrationWarning || ep(t.textContent, n) ? (r.popover != null && (Q("beforetoggle", t), Q("toggle", t)), r.onScroll != null && Q("scroll", t), r.onScrollEnd != null && Q("scrollend", t), r.onClick != null && (t.onclick = R), t = !0) : t = !1, t || aa(e, !0);
	}
	function sa(e) {
		for (ta = e.return; ta;) switch (ta.tag) {
			case 5:
			case 31:
			case 13:
				ra = !1;
				return;
			case 27:
			case 3:
				ra = !0;
				return;
			default: ta = ta.return;
		}
	}
	function ca(e) {
		if (e !== ta) return !1;
		if (!U) return sa(e), U = !0, !1;
		var t = e.tag, n;
		if ((n = t !== 3 && t !== 27) && ((n = t === 5) && (n = e.type, n = n === "form" || n === "button" || pp(e.type, e.memoizedProps)), n = !n), n && H && aa(e), sa(e), t === 13) {
			if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(317));
			H = dm(e);
		} else if (t === 31) {
			if (e = e.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(317));
			H = dm(e);
		} else t === 27 ? (t = H, Sp(e.type) ? (e = um, um = null, H = e) : H = t) : H = ta ? lm(e.stateNode.nextSibling) : null;
		return !0;
	}
	function la() {
		H = ta = null, U = !1;
	}
	function ua() {
		var e = na;
		return e !== null && (fd === null ? fd = e : fd.push.apply(fd, e), na = null), e;
	}
	function da(e) {
		na === null ? na = [e] : na.push(e);
	}
	var fa = De(null), pa = null, ma = null;
	function ha(e, t, n) {
		A(fa, t._currentValue), t._currentValue = n;
	}
	function ga(e) {
		e._currentValue = fa.current, k(fa);
	}
	function _a(e, t, n) {
		for (; e !== null;) {
			var r = e.alternate;
			if ((e.childLanes & t) === t ? r !== null && (r.childLanes & t) !== t && (r.childLanes |= t) : (e.childLanes |= t, r !== null && (r.childLanes |= t)), e === n) break;
			e = e.return;
		}
	}
	function va(e, t, n, r) {
		var a = e.child;
		for (a !== null && (a.return = e); a !== null;) {
			var o = a.dependencies;
			if (o !== null) {
				var s = a.child;
				o = o.firstContext;
				a: for (; o !== null;) {
					var c = o;
					o = a;
					for (var l = 0; l < t.length; l++) if (c.context === t[l]) {
						o.lanes |= n, c = o.alternate, c !== null && (c.lanes |= n), _a(o.return, n, e), r || (s = null);
						break a;
					}
					o = c.next;
				}
			} else if (a.tag === 18) {
				if (s = a.return, s === null) throw Error(i(341));
				s.lanes |= n, o = s.alternate, o !== null && (o.lanes |= n), _a(s, n, e), s = null;
			} else a.tag === 13 && a.memoizedState !== null && a.memoizedState.dehydrated === null ? (a.lanes |= n, s = a.alternate, s !== null && (s.lanes |= n), _a(a.return, n, e), s = a.child, s = s === null ? null : s.sibling) : s = a.child;
			if (s !== null) s.return = a;
			else for (s = a; s !== null;) {
				if (s === e) {
					s = null;
					break;
				}
				if (a = s.sibling, a !== null) {
					a.return = s.return, s = a;
					break;
				}
				s = s.return;
			}
			a = s;
		}
	}
	function ya(e, t, n, r) {
		e = null;
		for (var a = t, o = !1; a !== null;) {
			if (!o) {
				if (a.flags & 524288) o = !0;
				else if (a.flags & 262144) break;
			}
			if (a.tag === 10) {
				var s = a.alternate;
				if (s === null) throw Error(i(387));
				if (s = s.memoizedProps, s !== null) {
					var c = a.type;
					zr(a.pendingProps.value, s.value) || (e === null ? e = [c] : e.push(c));
				}
			} else if (a === je.current) {
				if (s = a.alternate, s === null) throw Error(i(387));
				s.memoizedState.memoizedState !== a.memoizedState.memoizedState && (e === null ? e = [sh] : e.push(sh));
			}
			a = a.return;
		}
		return e !== null && va(t, e, n, r), t.flags |= 262144, e !== null;
	}
	function ba(e) {
		for (e = e.firstContext; e !== null;) {
			if (!zr(e.context._currentValue, e.memoizedValue)) return !0;
			e = e.next;
		}
		return !1;
	}
	function xa(e) {
		pa = e, ma = null, e = e.dependencies, e !== null && (e.firstContext = null);
	}
	function Sa(e) {
		return wa(pa, e);
	}
	function Ca(e, t) {
		return pa === null && xa(e), wa(e, t);
	}
	function wa(e, t) {
		var n = t._currentValue;
		if (t = {
			context: t,
			memoizedValue: n,
			next: null
		}, ma === null) {
			if (e === null) throw Error(i(308));
			ma = t, e.dependencies = {
				lanes: 0,
				firstContext: t
			}, e.flags |= 524288;
		} else ma = ma.next = t;
		return n;
	}
	var Ta = typeof AbortController < "u" ? AbortController : function() {
		var e = [], t = this.signal = {
			aborted: !1,
			addEventListener: function(t, n) {
				e.push(n);
			}
		};
		this.abort = function() {
			t.aborted = !0, e.forEach(function(e) {
				return e();
			});
		};
	}, Ea = t.unstable_scheduleCallback, Da = t.unstable_NormalPriority, Oa = {
		$$typeof: le,
		Consumer: null,
		Provider: null,
		_currentValue: null,
		_currentValue2: null,
		_threadCount: 0
	};
	function ka() {
		return {
			controller: new Ta(),
			data: /* @__PURE__ */ new Map(),
			refCount: 0
		};
	}
	function Aa(e) {
		e.refCount--, e.refCount === 0 && Ea(Da, function() {
			e.controller.abort();
		});
	}
	function ja(e, t) {
		if (e.pendingLanes & 4194048) {
			var n = e.transitionTypes;
			for (n === null && (n = e.transitionTypes = []), e = 0; e < t.length; e++) {
				var r = t[e];
				n.indexOf(r) === -1 && n.push(r);
			}
		}
	}
	var Ma = null;
	function Na(e) {
		var t = e.transitionTypes;
		return e.transitionTypes = null, t;
	}
	var Pa = null, Fa = 0, Ia = 0, La = null;
	function Ra(e, t) {
		if (Pa === null) {
			var n = Pa = [];
			Fa = 0, Ia = Pf(), La = {
				status: "pending",
				value: void 0,
				then: function(e) {
					n.push(e);
				}
			};
		}
		return Fa++, t.then(za, za), t;
	}
	function za() {
		if (--Fa === 0 && (Ma = null, Pa !== null)) {
			La !== null && (La.status = "fulfilled");
			var e = Pa;
			Pa = null, Ia = 0, La = null;
			for (var t = 0; t < e.length; t++) (0, e[t])();
		}
	}
	function Ba(e, t) {
		var n = [], r = {
			status: "pending",
			value: null,
			reason: null,
			then: function(e) {
				n.push(e);
			}
		};
		return e.then(function() {
			r.status = "fulfilled", r.value = t;
			for (var e = 0; e < n.length; e++) (0, n[e])(t);
		}, function(e) {
			for (r.status = "rejected", r.reason = e, e = 0; e < n.length; e++) (0, n[e])(void 0);
		}), r;
	}
	var Va = E.S;
	E.S = function(e, t) {
		if (hd = N(), typeof t == "object" && t && typeof t.then == "function" && Ra(e, t), Ma !== null) for (var n = bf; n !== null;) ja(n, Ma), n = n.next;
		if (n = e.types, n !== null) {
			for (var r = bf; r !== null;) ja(r, n), r = r.next;
			if (Ia !== 0) {
				r = Ma, r === null && (r = Ma = []);
				for (var i = 0; i < n.length; i++) {
					var a = n[i];
					r.indexOf(a) === -1 && r.push(a);
				}
			}
		}
		Va !== null && Va(e, t);
	};
	var Ha = De(null);
	function Ua() {
		var e = Ha.current;
		return e === null ? $u.pooledCache : e;
	}
	function Wa(e, t) {
		t === null ? A(Ha, Ha.current) : A(Ha, t.pool);
	}
	function Ga() {
		var e = Ua();
		return e === null ? null : {
			parent: Oa._currentValue,
			pool: e
		};
	}
	var Ka = Error(i(460)), qa = Error(i(474)), Ja = Error(i(542)), Ya = { then: function() {} };
	function Xa(e) {
		return e = e.status, e === "fulfilled" || e === "rejected";
	}
	function Za(e, t, n) {
		switch (n = e[n], n === void 0 ? e.push(t) : n !== t && (t.then(R, R), t = n), t.status) {
			case "fulfilled": return t.value;
			case "rejected": throw e = t.reason, to(e), e === void 0 && !("reason" in t) ? Error(i(600)) : e;
			default:
				if (typeof t.status == "string") t.then(R, R);
				else {
					if (e = $u, e !== null && 100 < e.shellSuspendCounter) throw Error(i(482));
					e = t, e.status = "pending", e.then(function(e) {
						if (t.status === "pending") {
							var n = t;
							n.status = "fulfilled", n.value = e;
						}
					}, function(e) {
						if (t.status === "pending") {
							var n = t;
							n.status = "rejected", n.reason = e;
						}
					});
				}
				switch (t.status) {
					case "fulfilled": return t.value;
					case "rejected": throw e = t.reason, to(e), e;
				}
				throw $a = t, Ka;
		}
	}
	function Qa(e) {
		try {
			var t = e._init;
			return t(e._payload);
		} catch (e) {
			throw typeof e == "object" && e && typeof e.then == "function" ? ($a = e, Ka) : e;
		}
	}
	var $a = null;
	function eo() {
		if ($a === null) throw Error(i(459));
		var e = $a;
		return $a = null, e;
	}
	function to(e) {
		if (e === Ka || e === Ja) throw Error(i(483));
	}
	var no = null, ro = 0;
	function io(e) {
		var t = ro;
		return ro += 1, no === null && (no = []), Za(no, e, t);
	}
	function ao(e, t) {
		t = t.props.ref, e.ref = t === void 0 ? null : t;
	}
	function oo(e, t) {
		throw t.$$typeof === ne ? Error(i(525)) : (e = Object.prototype.toString.call(t), Error(i(31, e === "[object Object]" ? "object with keys {" + Object.keys(t).join(", ") + "}" : e)));
	}
	function so(e) {
		function t(t, n) {
			if (e) {
				var r = t.deletions;
				r === null ? (t.deletions = [n], t.flags |= 16) : r.push(n);
			}
		}
		function n(n, r) {
			if (!e) return null;
			for (; r !== null;) t(n, r), r = r.sibling;
			return null;
		}
		function r(e) {
			for (var t = /* @__PURE__ */ new Map(); e !== null;) e.key === null ? t.set(e.index, e) : t.set(e.key, e), e = e.sibling;
			return t;
		}
		function a(e, t) {
			return e = Mi(e, t), e.index = 0, e.sibling = null, e;
		}
		function o(t, n, r) {
			return t.index = r, e ? (r = t.alternate, r === null ? (t.flags |= 134217730, n) : (r = r.index, r < n ? (t.flags |= 2, n) : r)) : (t.flags |= 1048576, n);
		}
		function s(t) {
			return e && t.alternate === null && (t.flags |= 134217730), t;
		}
		function c(e, t, n, r) {
			return t === null || t.tag !== 6 ? (t = Ii(n, e.mode, r), t.return = e, t) : (t = a(t, n), t.return = e, t);
		}
		function l(e, t, n, r) {
			var i = n.type;
			return i === ae ? (e = d(e, t, n.props.children, r, n.key), ao(e, n), e) : t !== null && (t.elementType === i || typeof i == "object" && i && i.$$typeof === me && Qa(i) === t.type) ? (t = a(t, n.props), ao(t, n), t.return = e, t) : (t = Pi(n.type, n.key, n.props, null, e.mode, r), ao(t, n), t.return = e, t);
		}
		function u(e, t, n, r) {
			return t === null || t.tag !== 4 || t.stateNode.containerInfo !== n.containerInfo || t.stateNode.implementation !== n.implementation ? (t = Ri(n, e.mode, r), t.return = e, t) : (t = a(t, n.children || []), t.return = e, t);
		}
		function d(e, t, n, r, i) {
			return t === null || t.tag !== 7 ? (t = Fi(n, e.mode, r, i), t.return = e, t) : (t = a(t, n), t.return = e, t);
		}
		function f(e, t, n) {
			if (typeof t == "string" && t !== "" || typeof t == "number" || typeof t == "bigint") return t = Ii("" + t, e.mode, n), t.return = e, t;
			if (typeof t == "object" && t) {
				switch (t.$$typeof) {
					case re: return n = Pi(t.type, t.key, t.props, null, e.mode, n), ao(n, t), n.return = e, n;
					case ie: return t = Ri(t, e.mode, n), t.return = e, t;
					case me: return t = Qa(t), f(e, t, n);
				}
				if (we(t) || xe(t)) return t = Fi(t, e.mode, n, null), t.return = e, t;
				if (typeof t.then == "function") return f(e, io(t), n);
				if (t.$$typeof === le) return f(e, Ca(e, t), n);
				oo(e, t);
			}
			return null;
		}
		function p(e, t, n, r) {
			var i = t === null ? null : t.key;
			if (typeof n == "string" && n !== "" || typeof n == "number" || typeof n == "bigint") return i === null ? c(e, t, "" + n, r) : null;
			if (typeof n == "object" && n) {
				switch (n.$$typeof) {
					case re: return n.key === i ? l(e, t, n, r) : null;
					case ie: return n.key === i ? u(e, t, n, r) : null;
					case me: return n = Qa(n), p(e, t, n, r);
				}
				if (we(n) || xe(n)) return i === null ? d(e, t, n, r, null) : null;
				if (typeof n.then == "function") return p(e, t, io(n), r);
				if (n.$$typeof === le) return p(e, t, Ca(e, n), r);
				oo(e, n);
			}
			return null;
		}
		function m(e, t, n, r, i) {
			if (typeof r == "string" && r !== "" || typeof r == "number" || typeof r == "bigint") return e = e.get(n) || null, c(t, e, "" + r, i);
			if (typeof r == "object" && r) {
				switch (r.$$typeof) {
					case re: return e = e.get(r.key === null ? n : r.key) || null, l(t, e, r, i);
					case ie: return e = e.get(r.key === null ? n : r.key) || null, u(t, e, r, i);
					case me: return r = Qa(r), m(e, t, n, r, i);
				}
				if (we(r) || xe(r)) return e = e.get(n) || null, d(t, e, r, i, null);
				if (typeof r.then == "function") return m(e, t, n, io(r), i);
				if (r.$$typeof === le) return m(e, t, n, Ca(t, r), i);
				oo(t, r);
			}
			return null;
		}
		function h(i, a, s, c) {
			for (var l = null, u = null, d = a, h = a = 0, g = null; d !== null && h < s.length; h++) {
				d.index > h ? (g = d, d = null) : g = d.sibling;
				var _ = p(i, d, s[h], c);
				if (_ === null) {
					d === null && (d = g);
					break;
				}
				e && d && _.alternate === null && t(i, d), a = o(_, a, h), u === null ? l = _ : u.sibling = _, u = _, d = g;
			}
			if (h === s.length) return n(i, d), U && Xi(i, h), l;
			if (d === null) {
				for (; h < s.length; h++) d = f(i, s[h], c), d !== null && (a = o(d, a, h), u === null ? l = d : u.sibling = d, u = d);
				return U && Xi(i, h), l;
			}
			for (d = r(d); h < s.length; h++) g = m(d, i, h, s[h], c), g !== null && (e && (_ = g.alternate, _ !== null && d.delete(_.key === null ? h : _.key)), a = o(g, a, h), u === null ? l = g : u.sibling = g, u = g);
			return e && d.forEach(function(e) {
				return t(i, e);
			}), U && Xi(i, h), l;
		}
		function g(a, s, c, l) {
			if (c == null) throw Error(i(151));
			for (var u = null, d = null, h = s, g = s = 0, _ = null, v = c.next(); h !== null && !v.done; g++, v = c.next()) {
				h.index > g ? (_ = h, h = null) : _ = h.sibling;
				var y = p(a, h, v.value, l);
				if (y === null) {
					h === null && (h = _);
					break;
				}
				e && h && y.alternate === null && t(a, h), s = o(y, s, g), d === null ? u = y : d.sibling = y, d = y, h = _;
			}
			if (v.done) return n(a, h), U && Xi(a, g), u;
			if (h === null) {
				for (; !v.done; g++, v = c.next()) v = f(a, v.value, l), v !== null && (s = o(v, s, g), d === null ? u = v : d.sibling = v, d = v);
				return U && Xi(a, g), u;
			}
			for (h = r(h); !v.done; g++, v = c.next()) v = m(h, a, g, v.value, l), v !== null && (e && (_ = v.alternate, _ !== null && h.delete(_.key === null ? g : _.key)), s = o(v, s, g), d === null ? u = v : d.sibling = v, d = v);
			return e && h.forEach(function(e) {
				return t(a, e);
			}), U && Xi(a, g), u;
		}
		function _(e, r, o, c) {
			if (typeof o == "object" && o && o.type === ae && o.key === null && o.props.ref === void 0 && (o = o.props.children), typeof o == "object" && o) {
				switch (o.$$typeof) {
					case re:
						a: {
							for (var l = o.key; r !== null;) {
								if (r.key === l) {
									if (l = o.type, l === ae) {
										if (r.tag === 7) {
											n(e, r.sibling), c = a(r, o.props.children), ao(c, o), c.return = e, e = c;
											break a;
										}
									} else if (r.elementType === l || typeof l == "object" && l && l.$$typeof === me && Qa(l) === r.type) {
										n(e, r.sibling), c = a(r, o.props), ao(c, o), c.return = e, e = c;
										break a;
									}
									n(e, r);
									break;
								}
								t(e, r), r = r.sibling;
							}
							o.type === ae ? (c = Fi(o.props.children, e.mode, c, o.key), ao(c, o), c.return = e, e = c) : (c = Pi(o.type, o.key, o.props, null, e.mode, c), ao(c, o), c.return = e, e = c);
						}
						return s(e);
					case ie:
						a: {
							for (l = o.key; r !== null;) {
								if (r.key === l) {
									if (r.tag === 4 && r.stateNode.containerInfo === o.containerInfo && r.stateNode.implementation === o.implementation) {
										n(e, r.sibling), c = a(r, o.children || []), c.return = e, e = c;
										break a;
									}
									n(e, r);
									break;
								}
								t(e, r), r = r.sibling;
							}
							c = Ri(o, e.mode, c), c.return = e, e = c;
						}
						return s(e);
					case me: return o = Qa(o), _(e, r, o, c);
				}
				if (we(o)) return h(e, r, o, c);
				if (xe(o)) {
					if (l = xe(o), typeof l != "function") throw Error(i(150));
					return o = l.call(o), g(e, r, o, c);
				}
				if (typeof o.then == "function") return _(e, r, io(o), c);
				if (o.$$typeof === le) return _(e, r, Ca(e, o), c);
				oo(e, o);
			}
			return typeof o == "string" && o !== "" || typeof o == "number" || typeof o == "bigint" ? (o = "" + o, r !== null && r.tag === 6 ? (n(e, r.sibling), c = a(r, o), c.return = e, e = c) : (n(e, r), c = Ii(o, e.mode, c), c.return = e, e = c), s(e)) : n(e, r);
		}
		return function(e, t, n, r) {
			try {
				ro = 0;
				var i = _(e, t, n, r);
				return no = null, i;
			} catch (t) {
				if (t === Ka || t === Ja) throw t;
				var a = Ai(29, t, null, e.mode);
				return a.lanes = r, a.return = e, a;
			}
		};
	}
	var co = so(!0), lo = so(!1), uo = !1;
	function fo(e) {
		e.updateQueue = {
			baseState: e.memoizedState,
			firstBaseUpdate: null,
			lastBaseUpdate: null,
			shared: {
				pending: null,
				lanes: 0,
				hiddenCallbacks: null
			},
			callbacks: null
		};
	}
	function po(e, t) {
		e = e.updateQueue, t.updateQueue === e && (t.updateQueue = {
			baseState: e.baseState,
			firstBaseUpdate: e.firstBaseUpdate,
			lastBaseUpdate: e.lastBaseUpdate,
			shared: e.shared,
			callbacks: null
		});
	}
	function mo(e) {
		return {
			lane: e,
			tag: 0,
			payload: null,
			callback: null,
			next: null
		};
	}
	function ho(e, t, n) {
		var r = e.updateQueue;
		if (r === null) return null;
		if (r = r.shared, q & 2) {
			var i = r.pending;
			return i === null ? t.next = t : (t.next = i.next, i.next = t), r.pending = t, t = Di(e), Ei(e, null, n), t;
		}
		return Ci(e, r, t, n), Di(e);
	}
	function go(e, t, n) {
		if (t = t.updateQueue, t !== null && (t = t.shared, n & 4194048)) {
			var r = t.lanes;
			r &= e.pendingLanes, n |= r, t.lanes = n, yt(e, n);
		}
	}
	function _o(e, t) {
		var n = e.updateQueue, r = e.alternate;
		if (r !== null && (r = r.updateQueue, n === r)) {
			var i = null, a = null;
			if (n = n.firstBaseUpdate, n !== null) {
				do {
					var o = {
						lane: n.lane,
						tag: n.tag,
						payload: n.payload,
						callback: null,
						next: null
					};
					a === null ? i = a = o : a = a.next = o, n = n.next;
				} while (n !== null);
				a === null ? i = a = t : a = a.next = t;
			} else i = a = t;
			n = {
				baseState: r.baseState,
				firstBaseUpdate: i,
				lastBaseUpdate: a,
				shared: r.shared,
				callbacks: r.callbacks
			}, e.updateQueue = n;
		} else e = n.lastBaseUpdate, e === null ? n.firstBaseUpdate = t : e.next = t, n.lastBaseUpdate = t;
	}
	var vo = !1;
	function yo() {
		if (vo) {
			var e = La;
			if (e !== null) throw e;
		}
	}
	function bo(e, t, n, r) {
		vo = !1;
		var i = e.updateQueue;
		uo = !1;
		var a = i.firstBaseUpdate, o = i.lastBaseUpdate, s = i.shared.pending;
		if (s !== null) {
			i.shared.pending = null;
			var c = s, l = c.next;
			c.next = null, o === null ? a = l : o.next = l, o = c;
			var u = e.alternate;
			u !== null && (u = u.updateQueue, s = u.lastBaseUpdate, s !== o && (s === null ? u.firstBaseUpdate = l : s.next = l, u.lastBaseUpdate = c));
		}
		if (a !== null) {
			var d = i.baseState;
			o = 0, u = l = c = null, s = a;
			do {
				var f = s.lane & -536870913, p = f !== s.lane;
				if (p ? (Y & f) === f : (r & f) === f) {
					f !== 0 && f === Ia && (vo = !0), u !== null && (u = u.next = {
						lane: 0,
						tag: s.tag,
						payload: s.payload,
						callback: null,
						next: null
					});
					a: {
						var m = e, h = s;
						f = t;
						var g = n;
						switch (h.tag) {
							case 1:
								if (m = h.payload, typeof m == "function") {
									d = m.call(g, d, f);
									break a;
								}
								d = m;
								break a;
							case 3: m.flags = m.flags & -65537 | 128;
							case 0:
								if (m = h.payload, f = typeof m == "function" ? m.call(g, d, f) : m, f == null) break a;
								d = T({}, d, f);
								break a;
							case 2: uo = !0;
						}
					}
					f = s.callback, f !== null && (e.flags |= 64, p && (e.flags |= 8192), p = i.callbacks, p === null ? i.callbacks = [f] : p.push(f));
				} else p = {
					lane: f,
					tag: s.tag,
					payload: s.payload,
					callback: s.callback,
					next: null
				}, u === null ? (l = u = p, c = d) : u = u.next = p, o |= f;
				if (s = s.next, s === null) {
					if (s = i.shared.pending, s === null) break;
					p = s, s = p.next, p.next = null, i.lastBaseUpdate = p, i.shared.pending = null;
				}
			} while (1);
			u === null && (c = d), i.baseState = c, i.firstBaseUpdate = l, i.lastBaseUpdate = u, a === null && (i.shared.lanes = 0), od |= o, e.lanes = o, e.memoizedState = d;
		}
	}
	function xo(e, t) {
		if (typeof e != "function") throw Error(i(191, e));
		e.call(t);
	}
	function So(e, t) {
		var n = e.callbacks;
		if (n !== null) for (e.callbacks = null, e = 0; e < n.length; e++) xo(n[e], t);
	}
	var Co = De(null), wo = De(0);
	function To(e, t) {
		e = id, A(wo, e), A(Co, t), id = e | t.baseLanes;
	}
	function Eo() {
		A(wo, id), A(Co, Co.current);
	}
	function Do() {
		id = wo.current, k(Co), k(wo);
	}
	var Oo = De(null), ko = null;
	function Ao(e) {
		var t = e.alternate;
		A(Fo, Fo.current & 1), A(Oo, e), ko === null && (t === null || Co.current !== null || t.memoizedState !== null) && (ko = e);
	}
	function jo(e) {
		A(Fo, Fo.current), A(Oo, e), ko === null && (ko = e);
	}
	function Mo(e) {
		e.tag === 22 ? (A(Fo, Fo.current), A(Oo, e), ko === null && (ko = e)) : No();
	}
	function No() {
		A(Fo, Fo.current), A(Oo, Oo.current);
	}
	function Po(e) {
		k(Oo), ko === e && (ko = null), k(Fo);
	}
	var Fo = De(0);
	function Io(e, t) {
		A(Oo, Oo.current), A(Fo, t);
	}
	function Lo(e) {
		k(Fo), k(Oo), ko === e && (ko = null);
	}
	function Ro(e) {
		for (var t = e; t !== null;) {
			if (t.tag === 13) {
				var n = t.memoizedState;
				if (n !== null && (n = n.dehydrated, n === null || om(n) || sm(n))) return t;
			} else if (t.tag === 19 && t.memoizedProps.revealOrder !== "independent") {
				if (t.flags & 128) return t;
			} else if (t.child !== null) {
				t.child.return = t, t = t.child;
				continue;
			}
			if (t === e) break;
			for (; t.sibling === null;) {
				if (t.return === null || t.return === e) return null;
				t = t.return;
			}
			t.sibling.return = t.return, t = t.sibling;
		}
		return null;
	}
	var zo = 0, W = null, G = null, Bo = null, Vo = !1, Ho = !1, Uo = !1, Wo = 0, Go = 0, Ko = null, qo = 0;
	function Jo() {
		throw Error(i(321));
	}
	function Yo(e, t) {
		if (t === null) return !1;
		for (var n = 0; n < t.length && n < e.length; n++) if (!zr(e[n], t[n])) return !1;
		return !0;
	}
	function Xo(e, t, n, r, i, a) {
		return zo = a, W = t, t.memoizedState = null, t.updateQueue = null, t.lanes = 0, E.H = e === null || e.memoizedState === null ? pc : mc, Uo = !1, a = n(r, i), Uo = !1, Ho && (a = Qo(t, n, r, i)), Zo(e), a;
	}
	function Zo(e) {
		E.H = fc;
		var t = G !== null && G.next !== null;
		if (zo = 0, Bo = G = W = null, Vo = !1, Go = 0, Ko = null, t) throw Error(i(300));
		e === null || jc || (e = e.dependencies, e !== null && ba(e) && (jc = !0));
	}
	function Qo(e, t, n, r) {
		W = e;
		var a = 0;
		do {
			if (Ho && (Ko = null), Go = 0, Ho = !1, 25 <= a) throw Error(i(301));
			if (a += 1, Bo = G = null, e.updateQueue != null) {
				var o = e.updateQueue;
				o.lastEffect = null, o.events = null, o.stores = null, o.memoCache != null && (o.memoCache.index = 0);
			}
			E.H = hc, o = t(n, r);
		} while (Ho);
		return o;
	}
	function $o() {
		var e = E.H, t = e.useState()[0];
		return t = typeof t.then == "function" ? os(t) : t, e = e.useState()[0], (G === null ? null : G.memoizedState) !== e && (W.flags |= 1024), t;
	}
	function es() {
		var e = Wo !== 0;
		return Wo = 0, e;
	}
	function ts(e, t, n) {
		t.updateQueue = e.updateQueue, t.flags &= -2053, e.lanes &= ~n;
	}
	function ns(e) {
		if (Vo) {
			for (e = e.memoizedState; e !== null;) {
				var t = e.queue;
				t !== null && (t.pending = null), e = e.next;
			}
			Vo = !1;
		}
		zo = 0, Bo = G = W = null, Ho = !1, Go = Wo = 0, Ko = null;
	}
	function rs() {
		var e = {
			memoizedState: null,
			baseState: null,
			baseQueue: null,
			queue: null,
			next: null
		};
		return Bo === null ? W.memoizedState = Bo = e : Bo = Bo.next = e, Bo;
	}
	function is() {
		if (G === null) {
			var e = W.alternate;
			e = e === null ? null : e.memoizedState;
		} else e = G.next;
		var t = Bo === null ? W.memoizedState : Bo.next;
		if (t !== null) Bo = t, G = e;
		else {
			if (e === null) throw W.alternate === null ? Error(i(467)) : Error(i(310));
			G = e, e = {
				memoizedState: G.memoizedState,
				baseState: G.baseState,
				baseQueue: G.baseQueue,
				queue: G.queue,
				next: null
			}, Bo === null ? W.memoizedState = Bo = e : Bo = Bo.next = e;
		}
		return Bo;
	}
	function as() {
		return {
			lastEffect: null,
			events: null,
			stores: null,
			memoCache: null
		};
	}
	function os(e) {
		var t = Go;
		return Go += 1, Ko === null && (Ko = []), e = Za(Ko, e, t), t = W, (Bo === null ? t.memoizedState : Bo.next) === null && (t = t.alternate, E.H = t === null || t.memoizedState === null ? pc : mc), e;
	}
	function ss(e) {
		if (typeof e == "object" && e) {
			if (typeof e.then == "function") return os(e);
			if (e.$$typeof === ye) return;
			if (e.$$typeof === le) return Sa(e);
		}
		throw Error(i(438, String(e)));
	}
	function cs(e) {
		var t = null, n = W.updateQueue;
		if (n !== null && (t = n.memoCache), t == null) {
			var r = W.alternate;
			r !== null && (r = r.updateQueue, r !== null && (r = r.memoCache, r != null && (t = {
				data: r.data.map(function(e) {
					return e.slice();
				}),
				index: 0
			})));
		}
		if (t ??= {
			data: [],
			index: 0
		}, n === null && (n = as(), W.updateQueue = n), n.memoCache = t, n = t.data[t.index], n === void 0) for (n = t.data[t.index] = Array(e), r = 0; r < e; r++) n[r] = _e;
		return t.index++, n;
	}
	function ls(e, t) {
		return typeof t == "function" ? t(e) : t;
	}
	function us(e) {
		return ds(is(), G, e);
	}
	function ds(e, t, n) {
		var r = e.queue;
		if (r === null) throw Error(i(311));
		r.lastRenderedReducer = n;
		var a = e.baseQueue, o = r.pending;
		if (o !== null) {
			if (a !== null) {
				var s = a.next;
				a.next = o.next, o.next = s;
			}
			t.baseQueue = a = o, r.pending = null;
		}
		if (o = e.baseState, a === null) e.memoizedState = o;
		else {
			t = a.next;
			var c = s = null, l = null, u = t, d = !1;
			do {
				var f = u.lane & -536870913;
				if (f === u.lane ? (zo & f) === f : (Y & f) === f) {
					var p = u.revertLane;
					if (p === 0) l !== null && (l = l.next = {
						lane: 0,
						revertLane: 0,
						gesture: null,
						action: u.action,
						hasEagerState: u.hasEagerState,
						eagerState: u.eagerState,
						next: null
					}), f === Ia && (d = !0);
					else if ((zo & p) === p) {
						u = u.next, p === Ia && (d = !0);
						continue;
					} else f = {
						lane: 0,
						revertLane: u.revertLane,
						gesture: null,
						action: u.action,
						hasEagerState: u.hasEagerState,
						eagerState: u.eagerState,
						next: null
					}, l === null ? (c = l = f, s = o) : l = l.next = f, W.lanes |= p, od |= p;
					f = u.action, Uo && n(o, f), o = u.hasEagerState ? u.eagerState : n(o, f);
				} else p = {
					lane: f,
					revertLane: u.revertLane,
					gesture: u.gesture,
					action: u.action,
					hasEagerState: u.hasEagerState,
					eagerState: u.eagerState,
					next: null
				}, l === null ? (c = l = p, s = o) : l = l.next = p, W.lanes |= f, od |= f;
				u = u.next;
			} while (u !== null && u !== t);
			if (l === null ? s = o : l.next = c, !zr(o, e.memoizedState) && (jc = !0, d && (n = La, n !== null))) throw n;
			e.memoizedState = o, e.baseState = s, e.baseQueue = l, r.lastRenderedState = o;
		}
		return a === null && (r.lanes = 0), [e.memoizedState, r.dispatch];
	}
	function fs(e) {
		var t = is(), n = t.queue;
		if (n === null) throw Error(i(311));
		n.lastRenderedReducer = e;
		var r = n.dispatch, a = n.pending, o = t.memoizedState;
		if (a !== null) {
			n.pending = null;
			var s = a = a.next;
			do
				o = e(o, s.action), s = s.next;
			while (s !== a);
			zr(o, t.memoizedState) || (jc = !0), t.memoizedState = o, t.baseQueue === null && (t.baseState = o), n.lastRenderedState = o;
		}
		return [o, r];
	}
	function ps(e, t, n) {
		var r = W, a = is(), o = U;
		if (o) {
			if (n === void 0) throw Error(i(407));
			n = n();
		} else n = t();
		var s = !zr((G || a).memoizedState, n);
		if (s && (a.memoizedState = n, jc = !0), a = a.queue, Rs(gs.bind(null, r, a, e), [e]), e = a.getSnapshot !== t || s || Bo !== null && !!(Bo.memoizedState.tag & 1), Ns(e ? 9 : 8, { destroy: void 0 }, hs.bind(null, r, a, n, t), null), e) {
			if (r.flags |= 2048, $u === null) throw Error(i(349));
			o || zo & 127 || ms(r, t, n);
		}
		return n;
	}
	function ms(e, t, n) {
		e.flags |= 16384, e = {
			getSnapshot: t,
			value: n
		}, t = W.updateQueue, t === null ? (t = as(), W.updateQueue = t, t.stores = [e]) : (n = t.stores, n === null ? t.stores = [e] : n.push(e));
	}
	function hs(e, t, n, r) {
		t.value = n, t.getSnapshot = r, _s(t) && vs(e);
	}
	function gs(e, t, n) {
		return n(function() {
			_s(t) && vs(e);
		});
	}
	function _s(e) {
		var t = e.getSnapshot;
		e = e.value;
		try {
			var n = t();
			return !zr(e, n);
		} catch {
			return !0;
		}
	}
	function vs(e) {
		var t = Ti(e, 2);
		t !== null && Pd(t, e, 2);
	}
	function ys(e) {
		var t = rs();
		if (typeof e == "function") {
			var n = e;
			if (e = n(), Uo) {
				tt(!0);
				try {
					n();
				} finally {
					tt(!1);
				}
			}
		}
		return t.memoizedState = t.baseState = e, t.queue = {
			pending: null,
			lanes: 0,
			dispatch: null,
			lastRenderedReducer: ls,
			lastRenderedState: e
		}, t;
	}
	function bs(e, t, n, r) {
		return e.baseState = n, ds(e, G, typeof r == "function" ? r : ls);
	}
	function xs(e, t, n, r, a) {
		if (lc(e)) throw Error(i(485));
		if (e = t.action, e !== null) {
			var o = {
				payload: a,
				action: e,
				next: null,
				isTransition: !0,
				status: "pending",
				value: null,
				reason: null,
				listeners: [],
				then: function(e) {
					o.listeners.push(e);
				}
			};
			E.T === null ? o.isTransition = !1 : n(!0), r(o), n = t.pending, n === null ? (o.next = t.pending = o, Ss(t, o)) : (o.next = n.next, t.pending = n.next = o);
		}
	}
	function Ss(e, t) {
		var n = t.action, r = t.payload, i = e.state;
		if (t.isTransition) {
			var a = E.T, o = {};
			o.types = a === null ? null : a.types, E.T = o;
			try {
				var s = n(i, r), c = E.S;
				c !== null && c(o, s), Cs(e, t, s);
			} catch (n) {
				Ts(e, t, n);
			} finally {
				a !== null && o.types !== null && (a.types = o.types), E.T = a;
			}
		} else try {
			a = n(i, r), Cs(e, t, a);
		} catch (n) {
			Ts(e, t, n);
		}
	}
	function Cs(e, t, n) {
		typeof n == "object" && n && typeof n.then == "function" ? n.then(function(n) {
			ws(e, t, n);
		}, function(n) {
			return Ts(e, t, n);
		}) : ws(e, t, n);
	}
	function ws(e, t, n) {
		t.status = "fulfilled", t.value = n, Es(t), e.state = n, t = e.pending, t !== null && (n = t.next, n === t ? e.pending = null : (n = n.next, t.next = n, Ss(e, n)));
	}
	function Ts(e, t, n) {
		var r = e.pending;
		if (e.pending = null, r !== null) {
			r = r.next;
			do
				t.status = "rejected", t.reason = n, Es(t), t = t.next;
			while (t !== r);
		}
		e.action = null;
	}
	function Es(e) {
		e = e.listeners;
		for (var t = 0; t < e.length; t++) (0, e[t])();
	}
	function Ds(e, t) {
		return t;
	}
	function Os(e, t) {
		if (U) {
			var n = $u.formState;
			if (n !== null) {
				a: {
					var r = W;
					if (U) {
						if (H) {
							b: {
								for (var i = H, a = ra; i.nodeType !== 8;) if (!a || (i = lm(i.nextSibling), i === null)) {
									i = null;
									break b;
								}
								a = i.data, i = a === "F!" || a === "F" ? i : null;
							}
							if (i) {
								H = lm(i.nextSibling), r = i.data === "F!";
								break a;
							}
						}
						aa(r);
					}
					r = !1;
				}
				r && (t = n[0]);
			}
		}
		return n = rs(), n.memoizedState = n.baseState = t, r = {
			pending: null,
			lanes: 0,
			dispatch: null,
			lastRenderedReducer: Ds,
			lastRenderedState: t
		}, n.queue = r, n = oc.bind(null, W, r), r.dispatch = n, r = ys(!1), a = cc.bind(null, W, !1, r.queue), r = rs(), i = {
			state: t,
			dispatch: null,
			action: e,
			pending: null
		}, r.queue = i, n = xs.bind(null, W, i, a, n), i.dispatch = n, r.memoizedState = e, [
			t,
			n,
			!1
		];
	}
	function ks(e) {
		return As(is(), G, e);
	}
	function As(e, t, n) {
		if (t = ds(e, t, Ds)[0], e = us(ls)[0], typeof t == "object" && t && typeof t.then == "function") try {
			var r = os(t);
		} catch (e) {
			throw e === Ka ? Ja : e;
		}
		else r = t;
		t = is();
		var i = t.queue, a = i.dispatch;
		return n !== t.memoizedState && (W.flags |= 2048, Ns(9, { destroy: void 0 }, js.bind(null, i, n), null)), [
			r,
			a,
			e
		];
	}
	function js(e, t) {
		e.action = t;
	}
	function Ms(e) {
		var t = is(), n = G;
		if (n !== null) return As(t, n, e);
		is(), t = t.memoizedState, n = is();
		var r = n.queue.dispatch;
		return n.memoizedState = e, [
			t,
			r,
			!1
		];
	}
	function Ns(e, t, n, r) {
		return e = {
			tag: e,
			create: n,
			deps: r,
			inst: t,
			next: null
		}, t = W.updateQueue, t === null && (t = as(), W.updateQueue = t), n = t.lastEffect, n === null ? t.lastEffect = e.next = e : (r = n.next, n.next = e, e.next = r, t.lastEffect = e), e;
	}
	function Ps() {
		return is().memoizedState;
	}
	function Fs(e, t, n, r) {
		var i = rs();
		W.flags |= e, i.memoizedState = Ns(1 | t, { destroy: void 0 }, n, r === void 0 ? null : r);
	}
	function Is(e, t, n, r) {
		var i = is();
		r = r === void 0 ? null : r;
		var a = i.memoizedState.inst;
		G !== null && r !== null && Yo(r, G.memoizedState.deps) ? i.memoizedState = Ns(t, a, n, r) : (W.flags |= e, i.memoizedState = Ns(1 | t, a, n, r));
	}
	function Ls(e, t) {
		Fs(8390656, 8, e, t);
	}
	function Rs(e, t) {
		Is(2048, 8, e, t);
	}
	function zs(e) {
		W.flags |= 4;
		var t = W.updateQueue;
		if (t === null) t = as(), W.updateQueue = t, t.events = [e];
		else {
			var n = t.events;
			n === null ? t.events = [e] : n.push(e);
		}
	}
	function Bs(e) {
		var t = is().memoizedState;
		return zs({
			ref: t,
			nextImpl: e
		}), function() {
			if (q & 2) throw Error(i(440));
			return t.impl.apply(void 0, arguments);
		};
	}
	function Vs(e, t) {
		return Is(4, 2, e, t);
	}
	function Hs(e, t) {
		return Is(4, 4, e, t);
	}
	function Us(e, t) {
		if (typeof t == "function") {
			e = e();
			var n = t(e);
			return function() {
				typeof n == "function" ? n() : t(null);
			};
		}
		if (t != null) return e = e(), t.current = e, function() {
			t.current = null;
		};
	}
	function Ws(e, t, n) {
		n = n == null ? null : n.concat([e]), Is(4, 4, Us.bind(null, t, e), n);
	}
	function Gs() {}
	function Ks(e, t) {
		var n = is();
		t = t === void 0 ? null : t;
		var r = n.memoizedState;
		return t !== null && Yo(t, r[1]) ? r[0] : (n.memoizedState = [e, t], e);
	}
	function qs(e, t) {
		var n = is();
		t = t === void 0 ? null : t;
		var r = n.memoizedState;
		if (t !== null && Yo(t, r[1])) return r[0];
		if (r = e(), Uo) {
			tt(!0);
			try {
				e();
			} finally {
				tt(!1);
			}
		}
		return n.memoizedState = [r, t], r;
	}
	function Js(e, t, n) {
		return n === void 0 || zo & 1073741824 && !(Y & 261930) ? e.memoizedState = t : (e.memoizedState = n, e = Md(), W.lanes |= e, od |= e, n);
	}
	function Ys(e, t, n, r) {
		return zr(n, t) ? n : Co.current === null ? !(zo & 106) || zo & 1073741824 && !(Y & 261930) ? (jc = !0, e.memoizedState = n) : (e = Md(), W.lanes |= e, od |= e, t) : (e = Js(e, n, r), zr(e, t) || (jc = !0), e);
	}
	function Xs(e, t, n, r, i) {
		var a = D.p;
		D.p = a !== 0 && 8 > a ? a : 8;
		var o = E.T, s = {};
		s.types = o === null ? null : o.types, E.T = s, cc(e, !1, t, n);
		try {
			var c = i(), l = E.S;
			l !== null && l(s, c), typeof c == "object" && c && typeof c.then == "function" ? sc(e, t, Ba(c, r), jd(e)) : sc(e, t, r, jd(e));
		} catch (n) {
			sc(e, t, {
				then: function() {},
				status: "rejected",
				reason: n
			}, jd());
		} finally {
			D.p = a, o !== null && s.types !== null && (o.types = s.types), E.T = o;
		}
	}
	function Zs() {}
	function Qs(e, t, n, r) {
		if (e.tag !== 5) throw Error(i(476));
		var a = $s(e).queue;
		Xs(e, a, t, O, n === null ? Zs : function() {
			return ec(e), n(r);
		});
	}
	function $s(e) {
		var t = e.memoizedState;
		if (t !== null) return t;
		t = {
			memoizedState: O,
			baseState: O,
			baseQueue: null,
			queue: {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: ls,
				lastRenderedState: O
			},
			next: null
		};
		var n = {};
		return t.next = {
			memoizedState: n,
			baseState: n,
			baseQueue: null,
			queue: {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: ls,
				lastRenderedState: n
			},
			next: null
		}, e.memoizedState = t, e = e.alternate, e !== null && (e.memoizedState = t), t;
	}
	function ec(e) {
		var t = $s(e);
		t.next === null && (t = e.alternate.memoizedState), sc(e, t.next.queue, {}, jd());
	}
	function tc() {
		return Sa(sh);
	}
	function nc() {
		return is().memoizedState;
	}
	function rc() {
		return is().memoizedState;
	}
	function ic(e) {
		for (var t = e.return; t !== null;) {
			switch (t.tag) {
				case 24:
				case 3:
					var n = jd();
					e = mo(n);
					var r = ho(t, e, n);
					r !== null && (Pd(r, t, n), go(r, t, n)), t = { cache: ka() }, e.payload = t;
					return;
			}
			t = t.return;
		}
	}
	function ac(e, t, n) {
		var r = jd();
		n = {
			lane: r,
			revertLane: 0,
			gesture: null,
			action: n,
			hasEagerState: !1,
			eagerState: null,
			next: null
		}, lc(e) ? uc(t, n) : (n = wi(e, t, n, r), n !== null && (Pd(n, e, r), dc(n, t, r)));
	}
	function oc(e, t, n) {
		sc(e, t, n, jd());
	}
	function sc(e, t, n, r) {
		var i = {
			lane: r,
			revertLane: 0,
			gesture: null,
			action: n,
			hasEagerState: !1,
			eagerState: null,
			next: null
		};
		if (lc(e)) uc(t, i);
		else {
			var a = e.alternate;
			if (e.lanes === 0 && (a === null || a.lanes === 0) && (a = t.lastRenderedReducer, a !== null)) try {
				var o = t.lastRenderedState, s = a(o, n);
				if (i.hasEagerState = !0, i.eagerState = s, zr(s, o)) return Ci(e, t, i, 0), $u === null && Si(), !1;
			} catch {}
			if (n = wi(e, t, i, r), n !== null) return Pd(n, e, r), dc(n, t, r), !0;
		}
		return !1;
	}
	function cc(e, t, n, r) {
		if (r = {
			lane: 2,
			revertLane: Pf(),
			gesture: null,
			action: r,
			hasEagerState: !1,
			eagerState: null,
			next: null
		}, lc(e)) {
			if (t) throw Error(i(479));
		} else t = wi(e, n, r, 2), t !== null && Pd(t, e, 2);
	}
	function lc(e) {
		var t = e.alternate;
		return e === W || t !== null && t === W;
	}
	function uc(e, t) {
		Ho = Vo = !0;
		var n = e.pending;
		n === null ? t.next = t : (t.next = n.next, n.next = t), e.pending = t;
	}
	function dc(e, t, n) {
		if (n & 4194048) {
			var r = t.lanes;
			r &= e.pendingLanes, n |= r, t.lanes = n, yt(e, n);
		}
	}
	var fc = {
		readContext: Sa,
		use: ss,
		useCallback: Jo,
		useContext: Jo,
		useEffect: Jo,
		useImperativeHandle: Jo,
		useLayoutEffect: Jo,
		useInsertionEffect: Jo,
		useMemo: Jo,
		useReducer: Jo,
		useRef: Jo,
		useState: Jo,
		useDebugValue: Jo,
		useDeferredValue: Jo,
		useTransition: Jo,
		useSyncExternalStore: Jo,
		useId: Jo,
		useHostTransitionStatus: Jo,
		useFormState: Jo,
		useActionState: Jo,
		useOptimistic: Jo,
		useMemoCache: Jo,
		useCacheRefresh: Jo,
		useEffectEvent: Jo
	}, pc = {
		readContext: Sa,
		use: ss,
		useCallback: function(e, t) {
			return rs().memoizedState = [e, t === void 0 ? null : t], e;
		},
		useContext: Sa,
		useEffect: Ls,
		useImperativeHandle: function(e, t, n) {
			n = n == null ? null : n.concat([e]), Fs(4194308, 4, Us.bind(null, t, e), n);
		},
		useLayoutEffect: function(e, t) {
			return Fs(4194308, 4, e, t);
		},
		useInsertionEffect: function(e, t) {
			Fs(4, 2, e, t);
		},
		useMemo: function(e, t) {
			var n = rs();
			t = t === void 0 ? null : t;
			var r = e();
			if (Uo) {
				tt(!0);
				try {
					e();
				} finally {
					tt(!1);
				}
			}
			return n.memoizedState = [r, t], r;
		},
		useReducer: function(e, t, n) {
			var r = rs();
			if (n !== void 0) {
				var i = n(t);
				if (Uo) {
					tt(!0);
					try {
						n(t);
					} finally {
						tt(!1);
					}
				}
			} else i = t;
			return r.memoizedState = r.baseState = i, e = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: e,
				lastRenderedState: i
			}, r.queue = e, e = e.dispatch = ac.bind(null, W, e), [r.memoizedState, e];
		},
		useRef: function(e) {
			var t = rs();
			return e = { current: e }, t.memoizedState = e;
		},
		useState: function(e) {
			e = ys(e);
			var t = e.queue, n = oc.bind(null, W, t);
			return t.dispatch = n, [e.memoizedState, n];
		},
		useDebugValue: Gs,
		useDeferredValue: function(e, t) {
			return Js(rs(), e, t);
		},
		useTransition: function() {
			var e = ys(!1);
			return e = Xs.bind(null, W, e.queue, !0, !1), rs().memoizedState = e, [!1, e];
		},
		useSyncExternalStore: function(e, t, n) {
			var r = W, a = rs();
			if (U) {
				if (n === void 0) throw Error(i(407));
				n = n();
			} else {
				if (n = t(), $u === null) throw Error(i(349));
				Y & 127 || ms(r, t, n);
			}
			a.memoizedState = n;
			var o = {
				value: n,
				getSnapshot: t
			};
			return a.queue = o, Ls(gs.bind(null, r, o, e), [e]), r.flags |= 2048, Ns(9, { destroy: void 0 }, hs.bind(null, r, o, n, t), null), n;
		},
		useId: function() {
			var e = rs(), t = $u.identifierPrefix;
			if (U) {
				var n = Yi, r = Ji;
				n = (r & ~(1 << 32 - nt(r) - 1)).toString(32) + n, t = "_" + t + "R_" + n, n = Wo++, 0 < n && (t += "H" + n.toString(32)), t += "_";
			} else n = qo++, t = "_" + t + "r_" + n.toString(32) + "_";
			return e.memoizedState = t;
		},
		useHostTransitionStatus: tc,
		useFormState: Os,
		useActionState: Os,
		useOptimistic: function(e) {
			var t = rs();
			t.memoizedState = t.baseState = e;
			var n = {
				pending: null,
				lanes: 0,
				dispatch: null,
				lastRenderedReducer: null,
				lastRenderedState: null
			};
			return t.queue = n, t = cc.bind(null, W, !0, n), n.dispatch = t, [e, t];
		},
		useMemoCache: cs,
		useCacheRefresh: function() {
			return rs().memoizedState = ic.bind(null, W);
		},
		useEffectEvent: function(e) {
			var t = rs(), n = { impl: e };
			return t.memoizedState = n, function() {
				if (q & 2) throw Error(i(440));
				return n.impl.apply(void 0, arguments);
			};
		}
	}, mc = {
		readContext: Sa,
		use: ss,
		useCallback: Ks,
		useContext: Sa,
		useEffect: Rs,
		useImperativeHandle: Ws,
		useInsertionEffect: Vs,
		useLayoutEffect: Hs,
		useMemo: qs,
		useReducer: us,
		useRef: Ps,
		useState: function() {
			return us(ls);
		},
		useDebugValue: Gs,
		useDeferredValue: function(e, t) {
			return Ys(is(), G.memoizedState, e, t);
		},
		useTransition: function() {
			var e = us(ls)[0], t = is().memoizedState;
			return [typeof e == "boolean" ? e : os(e), t];
		},
		useSyncExternalStore: ps,
		useId: nc,
		useHostTransitionStatus: tc,
		useFormState: ks,
		useActionState: ks,
		useOptimistic: function(e, t) {
			return bs(is(), G, e, t);
		},
		useMemoCache: cs,
		useCacheRefresh: rc,
		useEffectEvent: Bs
	}, hc = {
		readContext: Sa,
		use: ss,
		useCallback: Ks,
		useContext: Sa,
		useEffect: Rs,
		useImperativeHandle: Ws,
		useInsertionEffect: Vs,
		useLayoutEffect: Hs,
		useMemo: qs,
		useReducer: fs,
		useRef: Ps,
		useState: function() {
			return fs(ls);
		},
		useDebugValue: Gs,
		useDeferredValue: function(e, t) {
			var n = is();
			return G === null ? Js(n, e, t) : Ys(n, G.memoizedState, e, t);
		},
		useTransition: function() {
			var e = fs(ls)[0], t = is().memoizedState;
			return [typeof e == "boolean" ? e : os(e), t];
		},
		useSyncExternalStore: ps,
		useId: nc,
		useHostTransitionStatus: tc,
		useFormState: Ms,
		useActionState: Ms,
		useOptimistic: function(e, t) {
			var n = is();
			return G === null ? (n.baseState = e, [e, n.queue.dispatch]) : bs(n, G, e, t);
		},
		useMemoCache: cs,
		useCacheRefresh: rc,
		useEffectEvent: Bs
	};
	function gc(e, t, n, r) {
		t = e.memoizedState, n = n(r, t), n = n == null ? t : T({}, t, n), e.memoizedState = n, e.lanes === 0 && (e.updateQueue.baseState = n);
	}
	var _c = {
		enqueueSetState: function(e, t, n) {
			e = e._reactInternals;
			var r = jd(), i = mo(r);
			i.payload = t, n != null && (i.callback = n), t = ho(e, i, r), t !== null && (Pd(t, e, r), go(t, e, r));
		},
		enqueueReplaceState: function(e, t, n) {
			e = e._reactInternals;
			var r = jd(), i = mo(r);
			i.tag = 1, i.payload = t, n != null && (i.callback = n), t = ho(e, i, r), t !== null && (Pd(t, e, r), go(t, e, r));
		},
		enqueueForceUpdate: function(e, t) {
			e = e._reactInternals;
			var n = jd(), r = mo(n);
			r.tag = 2, t != null && (r.callback = t), t = ho(e, r, n), t !== null && (Pd(t, e, n), go(t, e, n));
		}
	};
	function vc(e, t, n, r, i, a, o) {
		return e = e.stateNode, typeof e.shouldComponentUpdate == "function" ? e.shouldComponentUpdate(r, a, o) : t.prototype && t.prototype.isPureReactComponent ? !Br(n, r) || !Br(i, a) : !0;
	}
	function yc(e, t, n, r) {
		e = t.state, typeof t.componentWillReceiveProps == "function" && t.componentWillReceiveProps(n, r), typeof t.UNSAFE_componentWillReceiveProps == "function" && t.UNSAFE_componentWillReceiveProps(n, r), t.state !== e && _c.enqueueReplaceState(t, t.state, null);
	}
	function bc(e, t) {
		var n = t;
		if ("ref" in t) for (var r in n = {}, t) r !== "ref" && (n[r] = t[r]);
		if (e = e.defaultProps) for (var i in n === t && (n = T({}, n)), e) n[i] === void 0 && (n[i] = e[i]);
		return n;
	}
	function xc(e) {
		vi(e);
	}
	function Sc(e) {
		console.error(e);
	}
	function Cc(e) {
		vi(e);
	}
	function wc(e, t) {
		try {
			var n = e.onUncaughtError;
			n(t.value, { componentStack: t.stack });
		} catch (e) {
			setTimeout(function() {
				throw e;
			});
		}
	}
	function Tc(e, t, n) {
		try {
			var r = e.onCaughtError;
			r(n.value, {
				componentStack: n.stack,
				errorBoundary: t.tag === 1 ? t.stateNode : null
			});
		} catch (e) {
			setTimeout(function() {
				throw e;
			});
		}
	}
	function Ec(e, t, n) {
		return n = mo(n), n.tag = 3, n.payload = { element: null }, n.callback = function() {
			wc(e, t);
		}, n;
	}
	function Dc(e) {
		return e = mo(e), e.tag = 3, e;
	}
	function Oc(e, t, n, r) {
		var i = n.type.getDerivedStateFromError;
		if (typeof i == "function") {
			var a = r.value;
			e.payload = function() {
				return i(a);
			}, e.callback = function() {
				Tc(t, n, r);
			};
		}
		var o = n.stateNode;
		o !== null && typeof o.componentDidCatch == "function" && (e.callback = function() {
			Tc(t, n, r), typeof i != "function" && (vd === null ? vd = /* @__PURE__ */ new Set([this]) : vd.add(this));
			var e = r.stack;
			this.componentDidCatch(r.value, { componentStack: e === null ? "" : e });
		});
	}
	function kc(e, t, n, r, a) {
		if (n.flags |= 32768, typeof r == "object" && r && typeof r.then == "function") {
			if (t = n.alternate, t !== null && ya(t, n, a, !0), n = Oo.current, n !== null) {
				switch (n.tag) {
					case 31:
					case 13:
					case 19: return ko === null ? Kd() : n.alternate === null && ad === 0 && (ad = 3), n.flags &= -257, n.flags |= 65536, n.lanes = a, r === Ya ? n.flags |= 16384 : (t = n.updateQueue, t === null ? n.updateQueue = /* @__PURE__ */ new Set([r]) : t.add(r), mf(e, r, a)), !1;
					case 22: return n.flags |= 65536, r === Ya ? n.flags |= 16384 : (t = n.updateQueue, t === null ? (t = {
						transitions: null,
						markerInstances: null,
						retryQueue: /* @__PURE__ */ new Set([r])
					}, n.updateQueue = t) : (n = t.retryQueue, n === null ? t.retryQueue = /* @__PURE__ */ new Set([r]) : n.add(r)), mf(e, r, a)), !1;
				}
				throw Error(i(435, n.tag));
			}
			return mf(e, r, a), Kd(), !1;
		}
		if (U) return t = Oo.current, t === null ? (r !== ia && (t = Error(i(423), { cause: r }), da(Bi(t, n))), e = e.current.alternate, e.flags |= 65536, a &= -a, e.lanes |= a, r = Bi(r, n), a = Ec(e.stateNode, r, a), _o(e, a), ad !== 4 && (ad = 2)) : (!(t.flags & 65536) && (t.flags |= 256), t.flags |= 65536, t.lanes = a, r !== ia && (e = Error(i(422), { cause: r }), da(Bi(e, n)))), !1;
		var o = Error(i(520), { cause: r });
		if (o = Bi(o, n), dd === null ? dd = [o] : dd.push(o), ad !== 4 && (ad = 2), t === null) return !0;
		r = Bi(r, n), n = t;
		do {
			switch (n.tag) {
				case 3: return n.flags |= 65536, e = a & -a, n.lanes |= e, e = Ec(n.stateNode, r, e), _o(n, e), !1;
				case 1:
					if (t = n.type, o = n.stateNode, !(n.flags & 128) && (typeof t.getDerivedStateFromError == "function" || o !== null && typeof o.componentDidCatch == "function" && (vd === null || !vd.has(o)))) return n.flags |= 65536, a &= -a, n.lanes |= a, a = Dc(a), Oc(a, e, n, r), _o(n, a), !1;
					break;
				case 22: if (n.memoizedState !== null) return n.flags |= 65536, !1;
			}
			n = n.return;
		} while (n !== null);
		return !1;
	}
	var Ac = Error(i(461)), jc = !1;
	function Mc(e, t, n, r) {
		t.child = e === null ? lo(t, null, n, r) : co(t, e.child, n, r);
	}
	function Nc(e, t, n, r, i) {
		n = n.render;
		var a = t.ref;
		if ("ref" in r) {
			var o = {};
			for (var s in r) s !== "ref" && (o[s] = r[s]);
		} else o = r;
		return xa(t), r = Xo(e, t, n, o, a, i), s = es(), e !== null && !jc ? (ts(e, t, i), sl(e, t, i)) : (U && s && Qi(t), t.flags |= 1, Mc(e, t, r, i), t.child);
	}
	function Pc(e, t, n, r, i) {
		if (e === null) {
			var a = n.type;
			return typeof a == "function" && !ji(a) && a.defaultProps === void 0 && n.compare === null ? (t.tag = 15, t.type = a, Fc(e, t, a, r, i)) : (e = Pi(n.type, null, r, t, t.mode, i), e.ref = t.ref, e.return = t, t.child = e);
		}
		if (a = e.child, !cl(e, i)) {
			var o = a.memoizedProps;
			if (n = n.compare, n = n === null ? Br : n, n(o, r) && e.ref === t.ref) return sl(e, t, i);
		}
		return t.flags |= 1, e = Mi(a, r), e.ref = t.ref, e.return = t, t.child = e;
	}
	function Fc(e, t, n, r, i) {
		if (e !== null) {
			var a = e.memoizedProps;
			if (Br(a, r) && e.ref === t.ref) {
				if (jc = !1, t.pendingProps = r = a, cl(e, i)) e.flags & 131072 && (jc = !0);
				else return t.lanes = e.lanes, sl(e, t, i);
			}
		}
		return Uc(e, t, n, r, i);
	}
	function Ic(e, t, n, r) {
		var i = r.children, a = e === null ? null : e.memoizedState;
		if (e === null && t.stateNode === null && (t.stateNode = {
			_visibility: 1,
			_pendingMarkers: null,
			_retryCache: null,
			_transitions: null
		}), r.mode === "hidden") {
			if (t.flags & 128) {
				if (a = a === null ? n : a.baseLanes | n, e !== null) {
					for (r = t.child = e.child, i = 0; r !== null;) i = i | r.lanes | r.childLanes, r = r.sibling;
					r = i & ~a;
				} else r = 0, t.child = null;
				return Rc(e, t, a, n, r);
			}
			if (n & 536870912) t.memoizedState = {
				baseLanes: 0,
				cachePool: null
			}, e !== null && Wa(t, a === null ? null : a.cachePool), a === null ? Eo() : To(t, a), Mo(t);
			else return r = t.lanes = 536870912, Rc(e, t, a === null ? n : a.baseLanes | n, n, r);
		} else a === null ? (e !== null && Wa(t, null), Eo(), No()) : (Wa(t, a.cachePool), To(t, a), No(), t.memoizedState = null);
		return Mc(e, t, i, n), t.child;
	}
	function Lc(e, t) {
		return e !== null && e.tag === 22 || t.stateNode !== null || (t.stateNode = {
			_visibility: 1,
			_pendingMarkers: null,
			_retryCache: null,
			_transitions: null
		}), t.sibling;
	}
	function Rc(e, t, n, r, i) {
		var a = Ua();
		return a = a === null ? null : {
			parent: Oa._currentValue,
			pool: a
		}, t.memoizedState = {
			baseLanes: n,
			cachePool: a
		}, e !== null && Wa(t, null), Eo(), Mo(t), e !== null && ya(e, t, r, !0), t.childLanes = i, null;
	}
	function zc(e, t) {
		return t = Qc({
			mode: t.mode,
			children: t.children
		}, e.mode), t.ref = e.ref, e.child = t, t.return = e, t;
	}
	function Bc(e, t, n) {
		return co(t, e.child, null, n), e = zc(t, t.pendingProps), e.flags |= 2, Po(t), t.memoizedState = null, e;
	}
	function Vc(e, t, n) {
		var r = t.pendingProps, a = !!(t.flags & 128);
		if (t.flags &= -129, e === null) {
			if (U) {
				if (r.mode === "hidden") return e = zc(t, r), t.lanes = 536870912, e.memoizedState = {
					baseLanes: 0,
					cachePool: null
				}, Lc(null, e);
				if (jo(t), (e = H) ? (e = am(e, ra), e = e !== null && e.data === "&" ? e : null, e !== null && (t.memoizedState = {
					dehydrated: e,
					treeContext: qi === null ? null : {
						id: Ji,
						overflow: Yi
					},
					retryLane: 536870912,
					hydrationErrors: null
				}, n = Li(e), n.return = t, t.child = n, ta = t, H = null)) : e = null, e === null) throw aa(t);
				return t.lanes = 536870912, null;
			}
			return zc(t, r);
		}
		var o = e.memoizedState;
		if (o !== null) {
			var s = o.dehydrated;
			if (jo(t), a) {
				if (t.flags & 256) t.flags &= -257, t = Bc(e, t, n);
				else if (t.memoizedState !== null) t.child = e.child, t.flags |= 128, t = null;
				else throw Error(i(558));
			} else if (jc || ya(e, t, n, !1), a = (n & e.childLanes) !== 0, jc || a) {
				if (Co.current === null) {
					if (r = $u, r !== null && (s = bt(r, n), s !== 0 && s !== o.retryLane)) throw o.retryLane = s, Ti(e, s), Pd(r, e, s), Ac;
					Kd();
				}
				t = Bc(e, t, n);
			} else e = o.treeContext, H = lm(s.nextSibling), ta = t, U = !0, na = null, ra = !1, e !== null && ea(t, e), t = zc(t, r), t.flags |= 134221824;
			return t;
		}
		return e = Mi(e.child, {
			mode: r.mode,
			children: r.children
		}), e.ref = t.ref, t.child = e, e.return = t, e;
	}
	function Hc(e, t) {
		var n = t.ref;
		if (n === null) e !== null && e.ref !== null && (t.flags |= 4194816);
		else {
			if (typeof n != "function" && typeof n != "object") throw Error(i(284));
			(e === null || e.ref !== n) && (t.flags |= 4194816);
		}
	}
	function Uc(e, t, n, r, i) {
		return xa(t), n = Xo(e, t, n, r, void 0, i), r = es(), e !== null && !jc ? (ts(e, t, i), sl(e, t, i)) : (U && r && Qi(t), t.flags |= 1, Mc(e, t, n, i), t.child);
	}
	function Wc(e, t, n, r, i, a) {
		return xa(t), t.updateQueue = null, n = Qo(t, r, n, i), Zo(e), r = es(), e !== null && !jc ? (ts(e, t, a), sl(e, t, a)) : (U && r && Qi(t), t.flags |= 1, Mc(e, t, n, a), t.child);
	}
	function Gc(e, t, n, r, i) {
		if (xa(t), t.stateNode === null) {
			var a = Oi, o = n.contextType;
			typeof o == "object" && o && (a = Sa(o)), a = new n(r, a), t.memoizedState = a.state !== null && a.state !== void 0 ? a.state : null, a.updater = _c, t.stateNode = a, a._reactInternals = t, a = t.stateNode, a.props = r, a.state = t.memoizedState, a.refs = {}, fo(t), o = n.contextType, a.context = typeof o == "object" && o ? Sa(o) : Oi, a.state = t.memoizedState, o = n.getDerivedStateFromProps, typeof o == "function" && (gc(t, n, o, r), a.state = t.memoizedState), typeof n.getDerivedStateFromProps == "function" || typeof a.getSnapshotBeforeUpdate == "function" || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (o = a.state, typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount(), o !== a.state && _c.enqueueReplaceState(a, a.state, null), bo(t, r, a, i), yo(), a.state = t.memoizedState), typeof a.componentDidMount == "function" && (t.flags |= 4194308), r = !0;
		} else if (e === null) {
			a = t.stateNode;
			var s = t.memoizedProps, c = bc(n, s);
			a.props = c;
			var l = a.context, u = n.contextType;
			o = Oi, typeof u == "object" && u && (o = Sa(u));
			var d = n.getDerivedStateFromProps;
			u = typeof d == "function" || typeof a.getSnapshotBeforeUpdate == "function", s = t.pendingProps !== s, u || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (s || l !== o) && yc(t, a, r, o), uo = !1;
			var f = t.memoizedState;
			a.state = f, bo(t, r, a, i), yo(), l = t.memoizedState, s || f !== l || uo ? (typeof d == "function" && (gc(t, n, d, r), l = t.memoizedState), (c = uo || vc(t, n, c, r, f, l, o)) ? (u || typeof a.UNSAFE_componentWillMount != "function" && typeof a.componentWillMount != "function" || (typeof a.componentWillMount == "function" && a.componentWillMount(), typeof a.UNSAFE_componentWillMount == "function" && a.UNSAFE_componentWillMount()), typeof a.componentDidMount == "function" && (t.flags |= 4194308)) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), t.memoizedProps = r, t.memoizedState = l), a.props = r, a.state = l, a.context = o, r = c) : (typeof a.componentDidMount == "function" && (t.flags |= 4194308), r = !1);
		} else {
			a = t.stateNode, po(e, t), o = t.memoizedProps, u = bc(n, o), a.props = u, d = t.pendingProps, f = a.context, l = n.contextType, c = Oi, typeof l == "object" && l && (c = Sa(l)), s = n.getDerivedStateFromProps, (l = typeof s == "function" || typeof a.getSnapshotBeforeUpdate == "function") || typeof a.UNSAFE_componentWillReceiveProps != "function" && typeof a.componentWillReceiveProps != "function" || (o !== d || f !== c) && yc(t, a, r, c), uo = !1, f = t.memoizedState, a.state = f, bo(t, r, a, i), yo();
			var p = t.memoizedState;
			o !== d || f !== p || uo || e !== null && e.dependencies !== null && ba(e.dependencies) ? (typeof s == "function" && (gc(t, n, s, r), p = t.memoizedState), (u = uo || vc(t, n, u, r, f, p, c) || e !== null && e.dependencies !== null && ba(e.dependencies)) ? (l || typeof a.UNSAFE_componentWillUpdate != "function" && typeof a.componentWillUpdate != "function" || (typeof a.componentWillUpdate == "function" && a.componentWillUpdate(r, p, c), typeof a.UNSAFE_componentWillUpdate == "function" && a.UNSAFE_componentWillUpdate(r, p, c)), typeof a.componentDidUpdate == "function" && (t.flags |= 4), typeof a.getSnapshotBeforeUpdate == "function" && (t.flags |= 1024)) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 1024), t.memoizedProps = r, t.memoizedState = p), a.props = r, a.state = p, a.context = c, r = u) : (typeof a.componentDidUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 4), typeof a.getSnapshotBeforeUpdate != "function" || o === e.memoizedProps && f === e.memoizedState || (t.flags |= 1024), r = !1);
		}
		return a = r, Hc(e, t), r = !!(t.flags & 128), a || r ? (a = t.stateNode, n = r && typeof n.getDerivedStateFromError != "function" ? null : a.render(), t.flags |= 1, e !== null && r ? (t.child = co(t, e.child, null, i), t.child = co(t, null, n, i)) : Mc(e, t, n, i), t.memoizedState = a.state, e = t.child) : e = sl(e, t, i), e;
	}
	function Kc(e, t, n, r) {
		return la(), t.flags |= 256, Mc(e, t, n, r), t.child;
	}
	var qc = {
		dehydrated: null,
		treeContext: null,
		retryLane: 0,
		hydrationErrors: null
	};
	function Jc(e) {
		return {
			baseLanes: e,
			cachePool: Ga()
		};
	}
	function Yc(e, t, n) {
		return e = e === null ? 0 : e.childLanes & ~n, t && (e |= ld), e;
	}
	function Xc(e, t, n) {
		var r = t.pendingProps, i = !1, a = !!(t.flags & 128), o;
		if ((o = a) || (o = e !== null && e.memoizedState === null ? !1 : !!(Fo.current & 2)), o && (i = !0, t.flags &= -129), o = !!(t.flags & 32), t.flags &= -33, e === null) {
			if (U) {
				if (i ? Ao(t) : No(), (e = H) ? (e = am(e, ra), e = e !== null && e.data !== "&" ? e : null, e !== null && (t.memoizedState = {
					dehydrated: e,
					treeContext: qi === null ? null : {
						id: Ji,
						overflow: Yi
					},
					retryLane: 536870912,
					hydrationErrors: null
				}, n = Li(e), n.return = t, t.child = n, ta = t, H = null)) : e = null, e === null) throw aa(t);
				return t.lanes = sm(e) ? 32 : 536870912, null;
			}
			return a = r.children, r = r.fallback, i ? (No(), i = t.mode, a = Qc({
				mode: "hidden",
				children: a
			}, i), r = Fi(r, i, n, null), a.return = t, r.return = t, a.sibling = r, t.child = a, r = t.child, r.memoizedState = Jc(n), r.childLanes = Yc(e, o, n), t.memoizedState = qc, Lc(null, r)) : (Ao(t), Zc(t, a));
		}
		var s = e.memoizedState;
		if (s !== null) {
			var c = s.dehydrated;
			if (c !== null) return el(e, t, a, o, r, c, s, n);
		}
		return i ? (No(), i = r.fallback, a = t.mode, s = e.child, c = s.sibling, r = Mi(s, {
			mode: "hidden",
			children: r.children
		}), r.subtreeFlags = s.subtreeFlags & 1206910976, c === null ? (i = Fi(i, a, n, null), i.flags |= 2) : i = Mi(c, i), i.return = t, r.return = t, r.sibling = i, t.child = r, Lc(null, r), r = t.child, i = e.child.memoizedState, i === null ? i = Jc(n) : (a = i.cachePool, a === null ? a = Ga() : (s = Oa._currentValue, a = a.parent === s ? a : {
			parent: s,
			pool: s
		}), i = {
			baseLanes: i.baseLanes | n,
			cachePool: a
		}), r.memoizedState = i, r.childLanes = Yc(e, o, n), t.memoizedState = qc, Lc(e.child, r)) : (Ao(t), n = e.child, e = n.sibling, n = Mi(n, {
			mode: "visible",
			children: r.children
		}), n.return = t, n.sibling = null, e !== null && (o = t.deletions, o === null ? (t.deletions = [e], t.flags |= 16) : o.push(e)), t.child = n, t.memoizedState = null, n);
	}
	function Zc(e, t) {
		return t = Qc({
			mode: "visible",
			children: t
		}, e.mode), t.return = e, e.child = t;
	}
	function Qc(e, t) {
		return e = Ai(22, e, null, t), e.lanes = 0, e;
	}
	function $c(e, t, n) {
		return co(t, e.child, null, n), e = Zc(t, t.pendingProps.children), e.flags |= 2, t.memoizedState = null, e;
	}
	function el(e, t, n, r, a, o, s, c) {
		if (n) return t.flags & 256 ? (Ao(t), t.flags &= -257, $c(e, t, c)) : t.memoizedState === null ? (No(), o = a.fallback, s = t.mode, a = Qc({
			mode: "visible",
			children: a.children
		}, s), o = Fi(o, s, c, null), o.flags |= 2, a.return = t, o.return = t, a.sibling = o, t.child = a, co(t, e.child, null, c), a = t.child, a.memoizedState = Jc(c), a.childLanes = Yc(e, r, c), t.memoizedState = qc, Lc(null, a)) : (No(), t.child = e.child, t.flags |= 128, null);
		if (Ao(t), sm(o)) {
			if (r = o.nextSibling && o.nextSibling.dataset, r) var l = r.dgst;
			return r = l, r !== "" && (a = Error(i(419)), a.stack = "", a.digest = r, da({
				value: a,
				source: null,
				stack: null
			})), $c(e, t, c);
		}
		if (jc || ya(e, t, c, !1), r = (c & e.childLanes) !== 0, jc || r) {
			if (Co.current !== null) return $c(e, t, c);
			if (r = $u, r !== null && (a = bt(r, c), a !== 0 && a !== s.retryLane)) throw s.retryLane = a, Ti(e, a), Pd(r, e, a), Ac;
			return om(o) || Kd(), $c(e, t, c);
		}
		return om(o) ? (t.flags |= 192, t.child = e.child, null) : (e = s.treeContext, H = lm(o.nextSibling), ta = t, U = !0, na = null, ra = !1, e !== null && ea(t, e), t = Zc(t, a.children), t.flags |= 134221824, t);
	}
	function tl(e, t, n) {
		e.lanes |= t;
		var r = e.alternate;
		r !== null && (r.lanes |= t), _a(e.return, t, n);
	}
	function nl(e) {
		for (var t = null; e !== null;) {
			var n = e.alternate;
			n !== null && Ro(n) === null && (t = e), e = e.sibling;
		}
		return t;
	}
	function rl(e, t, n, r, i, a) {
		var o = e.memoizedState;
		o === null ? e.memoizedState = {
			isBackwards: t,
			rendering: null,
			renderingStartTime: 0,
			last: r,
			tail: n,
			tailMode: i,
			treeForkCount: a
		} : (o.isBackwards = t, o.rendering = null, o.renderingStartTime = 0, o.last = r, o.tail = n, o.tailMode = i, o.treeForkCount = a);
	}
	function il(e) {
		var t = e.child;
		for (e.child = null; t !== null;) {
			var n = t.sibling;
			t.sibling = e.child, e.child = t, t = n;
		}
	}
	function al(e, t, n) {
		var r = t.pendingProps, i = r.revealOrder, a = r.tail;
		r = r.children;
		var o = Fo.current;
		if (t.flags & 128) return Io(t, o), null;
		var s = !!(o & 2);
		if (s ? (o = o & 1 | 2, t.flags |= 128) : o &= 1, Io(t, o), i === "backwards" && e !== null ? (il(e), Mc(e, t, r, n), il(e)) : Mc(e, t, r, n), r = U ? Wi : 0, !s && e !== null && e.flags & 128) a: for (e = t.child; e !== null;) {
			if (e.tag === 13) e.memoizedState !== null && tl(e, n, t);
			else if (e.tag === 19) tl(e, n, t);
			else if (e.child !== null) {
				e.child.return = e, e = e.child;
				continue;
			}
			if (e === t) break a;
			for (; e.sibling === null;) {
				if (e.return === null || e.return === t) break a;
				e = e.return;
			}
			e.sibling.return = e.return, e = e.sibling;
		}
		switch (i) {
			case "backwards":
				n = nl(t.child), n === null ? (i = t.child, t.child = null) : (i = n.sibling, n.sibling = null, il(t)), rl(t, !0, i, null, a, r);
				break;
			case "unstable_legacy-backwards":
				for (n = null, i = t.child, t.child = null; i !== null;) {
					if (e = i.alternate, e !== null && Ro(e) === null) {
						t.child = i;
						break;
					}
					e = i.sibling, i.sibling = n, n = i, i = e;
				}
				rl(t, !0, n, null, a, r);
				break;
			case "together":
				rl(t, !1, null, null, void 0, r);
				break;
			case "independent":
				t.memoizedState = null;
				break;
			default: n = nl(t.child), n === null ? (i = t.child, t.child = null) : (i = n.sibling, n.sibling = null), rl(t, !1, i, n, a, r);
		}
		return t.child;
	}
	function ol(e, t, n) {
		var r = t.pendingProps;
		return ha(t, t.type, r.value), Mc(e, t, r.children, n), t.child;
	}
	function sl(e, t, n) {
		if (e !== null && (t.dependencies = e.dependencies), od |= t.lanes, (n & t.childLanes) === 0) {
			if (e !== null) {
				if (ya(e, t, n, !1), (n & t.childLanes) === 0) return null;
			} else return null;
		}
		if (e !== null && t.child !== e.child) throw Error(i(153));
		if (t.child !== null) {
			for (e = t.child, n = Mi(e, e.pendingProps), t.child = n, n.return = t; e.sibling !== null;) e = e.sibling, n = n.sibling = Mi(e, e.pendingProps), n.return = t;
			n.sibling = null;
		}
		return t.child;
	}
	function cl(e, t) {
		return (e.lanes & t) !== 0 || (e = e.dependencies, !!(e !== null && ba(e)));
	}
	function ll(e, t, n) {
		switch (t.tag) {
			case 3:
				Me(t, t.stateNode.containerInfo), ha(t, Oa, e.memoizedState.cache), la();
				break;
			case 27:
			case 5:
				Ne(t);
				break;
			case 4:
				Me(t, t.stateNode.containerInfo);
				break;
			case 10:
				ha(t, t.type, t.memoizedProps.value);
				break;
			case 31:
				if (t.memoizedState !== null) return t.flags |= 128, jo(t), null;
				break;
			case 13:
				var r = t.memoizedState;
				if (r !== null) {
					if (r.dehydrated !== null) return Ao(t), t.flags |= 128, null;
					r = ya(e, t, n, !1);
					var i = t.child.childLanes;
					return r || (n & i) !== 0 ? Xc(e, t, n) : (Ao(t), e = sl(e, t, n), e === null ? null : e.sibling);
				}
				Ao(t);
				break;
			case 19:
				if (t.flags & 128) return al(e, t, n);
				if (i = !!(e.flags & 128), r = (n & t.childLanes) !== 0, r ||= (ya(e, t, n, !1), (n & t.childLanes) !== 0), i) {
					if (r) return al(e, t, n);
					t.flags |= 128;
				}
				if (i = t.memoizedState, i !== null && (i.rendering = null, i.tail = null, i.lastEffect = null), Io(t, Fo.current), r) break;
				return null;
			case 22: return t.lanes = 0, Ic(e, t, n, t.pendingProps);
			case 24: ha(t, Oa, e.memoizedState.cache);
		}
		return sl(e, t, n);
	}
	function ul(e, t, n) {
		if (e !== null) {
			if (e.memoizedProps !== t.pendingProps) jc = !0;
			else {
				if (!cl(e, n) && !(t.flags & 128)) return jc = !1, ll(e, t, n);
				jc = !!(e.flags & 131072);
			}
		} else jc = !1, U && t.flags & 1048576 && Zi(t, Wi, t.index);
		switch (t.lanes = 0, t.tag) {
			case 16:
				a: {
					var r = t.pendingProps;
					if (e = Qa(t.elementType), t.type = e, typeof e == "function") ji(e) ? (r = bc(e, r), t.tag = 1, t = Gc(null, t, e, r, n)) : (t.tag = 0, t = Uc(null, t, e, r, n));
					else {
						if (e != null) {
							var a = e.$$typeof;
							if (a === ue) {
								t.tag = 11, t = Nc(null, t, e, r, n);
								break a;
							}
							if (a === pe) {
								t.tag = 14, t = Pc(null, t, e, r, n);
								break a;
							}
							if (a === le) {
								t.tag = 10, t.type = e, t = ol(null, t, n);
								break a;
							}
						}
						throw t = Ce(e) || e, Error(i(306, t, ""));
					}
				}
				return t;
			case 0: return Uc(e, t, t.type, t.pendingProps, n);
			case 1: return r = t.type, a = bc(r, t.pendingProps), Gc(e, t, r, a, n);
			case 3:
				a: {
					if (Me(t, t.stateNode.containerInfo), e === null) throw Error(i(387));
					r = t.pendingProps;
					var o = t.memoizedState;
					a = o.element, po(e, t), bo(t, r, null, n);
					var s = t.memoizedState;
					if (r = s.cache, ha(t, Oa, r), r !== o.cache && va(t, [Oa], n, !0), yo(), r = s.element, o.isDehydrated) {
						if (o = {
							element: r,
							isDehydrated: !1,
							cache: s.cache
						}, t.updateQueue.baseState = o, t.memoizedState = o, t.flags & 256) {
							t = Kc(e, t, r, n);
							break a;
						}
						if (r !== a) {
							a = Bi(Error(i(424)), t), da(a), t = Kc(e, t, r, n);
							break a;
						}
						switch (e = t.stateNode.containerInfo, e.nodeType) {
							case 9:
								e = e.body;
								break;
							default: e = e.nodeName === "HTML" ? e.ownerDocument.body : e;
						}
						for (H = lm(e.firstChild), ta = t, U = !0, na = null, ra = !0, n = lo(t, null, r, n), t.child = n; n;) n.flags = n.flags & -3 | 134221824, n = n.sibling;
					} else {
						if (la(), r === a) {
							t = sl(e, t, n);
							break a;
						}
						Mc(e, t, r, n);
					}
					t = t.child;
				}
				return t;
			case 26: return Hc(e, t), e === null ? (n = Nm(t.type, null, t.pendingProps, null)) ? t.memoizedState = n : U || (t.stateNode = fp(t.type, t.pendingProps, Ae.current, t)) : t.memoizedState = Nm(t.type, e.memoizedProps, t.pendingProps, e.memoizedState), null;
			case 27: return Ne(t), e === null && U && (r = t.stateNode = hm(t.type, t.pendingProps, Ae.current), ta = t, ra = !0, a = H, Sp(t.type) ? (um = a, H = lm(r.firstChild)) : H = a), Mc(e, t, t.pendingProps.children, n), Hc(e, t), e === null && (t.flags |= 4194304), t.child;
			case 5: return e === null && U && ((a = r = H) && (r = rm(r, t.type, t.pendingProps, ra), r === null ? a = !1 : (t.stateNode = r, ta = t, H = lm(r.firstChild), ra = !1, a = !0)), a || aa(t)), Ne(t), a = t.type, o = t.pendingProps, s = e === null ? null : e.memoizedProps, r = o.children, pp(a, o) ? r = null : s !== null && pp(a, s) && (t.flags |= 32), t.memoizedState !== null && (a = Xo(e, t, $o, null, null, n), sh._currentValue = a), Hc(e, t), Mc(e, t, r, n), t.child;
			case 6: return e === null && U && ((e = n = H) && (n = im(n, t.pendingProps, ra), n === null ? e = !1 : (t.stateNode = n, ta = t, H = null, e = !0)), e || aa(t)), null;
			case 13: return Xc(e, t, n);
			case 4: return Me(t, t.stateNode.containerInfo), r = t.pendingProps, e === null ? t.child = co(t, null, r, n) : Mc(e, t, r, n), t.child;
			case 11: return Nc(e, t, t.type, t.pendingProps, n);
			case 7: return r = t.pendingProps, Hc(e, t), Mc(e, t, r, n), t.child;
			case 8: return Mc(e, t, t.pendingProps.children, n), t.child;
			case 12: return Mc(e, t, t.pendingProps.children, n), t.child;
			case 10: return ol(e, t, n);
			case 9: return a = t.type._context, r = t.pendingProps.children, xa(t), a = Sa(a), r = r(a), t.flags |= 1, Mc(e, t, r, n), t.child;
			case 14: return Pc(e, t, t.type, t.pendingProps, n);
			case 15: return Fc(e, t, t.type, t.pendingProps, n);
			case 19: return al(e, t, n);
			case 31: return Vc(e, t, n);
			case 22: return Ic(e, t, n, t.pendingProps);
			case 24: return xa(t), r = Sa(Oa), e === null ? (a = Ua(), a === null && (a = $u, o = ka(), a.pooledCache = o, o.refCount++, o !== null && (a.pooledCacheLanes |= n), a = o), t.memoizedState = {
				parent: r,
				cache: a
			}, fo(t), ha(t, Oa, a)) : ((e.lanes & n) !== 0 && (po(e, t), bo(t, null, null, n), yo()), a = e.memoizedState, o = t.memoizedState, a.parent === r ? (r = o.cache, ha(t, Oa, r), r !== a.cache && va(t, [Oa], n, !0)) : (a = {
				parent: r,
				cache: r
			}, t.memoizedState = a, t.lanes === 0 && (t.memoizedState = t.updateQueue.baseState = a), ha(t, Oa, r))), Mc(e, t, t.pendingProps.children, n), t.child;
			case 30: return t.stateNode === null && (t.stateNode = {
				autoName: null,
				paired: null,
				clones: null,
				ref: null
			}), r = t.pendingProps, r.name != null && r.name !== "auto" ? t.flags |= e === null ? 18882560 : 18874368 : U && Qi(t), e !== null && e.memoizedProps.name !== r.name ? t.flags |= 4194816 : Hc(e, t), Mc(e, t, r.children, n), t.child;
			case 29: throw t.pendingProps;
		}
		throw Error(i(156, t.tag));
	}
	function dl(e) {
		e.flags |= 4;
	}
	function fl(e, t, n, r, i) {
		var a;
		if ((a = !!(e.mode & 32)) && (a = n === null ? Jm(t, r) : Jm(t, r) && (r.src !== n.src || r.srcSet !== n.srcSet)), a) {
			if (e.flags |= 16777216, (i & 335544128) === i) {
				if (e.stateNode.complete) e.flags |= 8192;
				else if (Ud()) e.flags |= 8192;
				else throw $a = Ya, qa;
			}
		} else e.flags &= -16777217;
	}
	function pl(e, t) {
		if (t.type !== "stylesheet" || t.state.loading & 4) e.flags &= -16777217;
		else if (e.flags |= 16777216, !Ym(t)) {
			if (Ud()) e.flags |= 8192;
			else throw $a = Ya, qa;
		}
	}
	function ml(e, t) {
		t !== null && (e.flags |= 4), e.flags & 16384 && (t = e.tag === 22 ? 536870912 : mt(), e.lanes |= t, ud |= t);
	}
	function hl(e, t) {
		if (!U) switch (e.tailMode) {
			case "visible": break;
			case "collapsed":
				for (var n = e.tail, r = null; n !== null;) n.alternate !== null && (r = n), n = n.sibling;
				r === null ? t || e.tail === null ? e.tail = null : e.tail.sibling = null : r.sibling = null;
				break;
			default:
				for (t = e.tail, n = null; t !== null;) t.alternate !== null && (n = t), t = t.sibling;
				n === null ? e.tail = null : n.sibling = null;
		}
	}
	function gl(e) {
		var t = e.alternate !== null && e.alternate.child === e.child, n = 0, r = 0;
		if (t) for (var i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags & 1206910976, r |= i.flags & 1206910976, i.return = e, i = i.sibling;
		else for (i = e.child; i !== null;) n |= i.lanes | i.childLanes, r |= i.subtreeFlags, r |= i.flags, i.return = e, i = i.sibling;
		return e.subtreeFlags |= r, e.childLanes = n, t;
	}
	function _l(e, t, n) {
		var r = t.pendingProps;
		switch ($i(t), t.tag) {
			case 16:
			case 15:
			case 0:
			case 11:
			case 7:
			case 8:
			case 12:
			case 9:
			case 14: return gl(t), null;
			case 1: return gl(t), null;
			case 3: return n = t.stateNode, r = null, e !== null && (r = e.memoizedState.cache), t.memoizedState.cache !== r && (t.flags |= 2048), ga(Oa), j(), n.pendingContext && (n.context = n.pendingContext, n.pendingContext = null), (e === null || e.child === null) && (ca(t) ? dl(t) : e === null || e.memoizedState.isDehydrated && !(t.flags & 256) || (t.flags |= 1024, ua())), gl(t), null;
			case 26:
				var a = t.type, o = t.memoizedState;
				return e === null ? (dl(t), o === null ? (gl(t), fl(t, a, null, r, n)) : (gl(t), pl(t, o))) : o ? o === e.memoizedState ? (gl(t), t.flags &= -16777217) : (dl(t), gl(t), pl(t, o)) : (e = e.memoizedProps, e !== r && dl(t), gl(t), fl(t, a, e, r, n)), null;
			case 27:
				if (Pe(t), n = Ae.current, a = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && dl(t);
				else {
					if (!r) {
						if (t.stateNode === null) throw Error(i(166));
						return gl(t), t.subtreeFlags &= -33554433, null;
					}
					e = Oe.current, ca(t) ? oa(t, e) : (e = hm(a, r, n), t.stateNode = e, dl(t));
				}
				return gl(t), t.subtreeFlags &= -33554433, null;
			case 5:
				if (Pe(t), a = t.type, e !== null && t.stateNode != null) e.memoizedProps !== r && dl(t);
				else {
					if (!r) {
						if (t.stateNode === null) throw Error(i(166));
						return gl(t), t.subtreeFlags &= -33554433, null;
					}
					if (o = Oe.current, ca(t)) oa(t, o);
					else {
						var s = lp(Ae.current);
						switch (o) {
							case 1:
								o = s.createElementNS("http://www.w3.org/2000/svg", a);
								break;
							case 2:
								o = s.createElementNS("http://www.w3.org/1998/Math/MathML", a);
								break;
							default: switch (a) {
								case "svg":
									o = s.createElementNS("http://www.w3.org/2000/svg", a);
									break;
								case "math":
									o = s.createElementNS("http://www.w3.org/1998/Math/MathML", a);
									break;
								case "script":
									o = s.createElement("div"), o.innerHTML = "<script><\/script>", o = o.removeChild(o.firstChild);
									break;
								case "select":
									o = typeof r.is == "string" ? s.createElement("select", { is: r.is }) : s.createElement("select"), r.multiple ? o.multiple = !0 : r.size && (o.size = r.size);
									break;
								default: o = typeof r.is == "string" ? s.createElement(a, { is: r.is }) : s.createElement(a);
							}
						}
						o[Et] = t, o[Dt] = r;
						a: for (s = t.child; s !== null;) {
							if (s.tag === 5 || s.tag === 6) o.appendChild(s.stateNode);
							else if (s.tag !== 4 && s.tag !== 27 && s.child !== null) {
								s.child.return = s, s = s.child;
								continue;
							}
							if (s === t) break a;
							for (; s.sibling === null;) {
								if (s.return === null || s.return === t) break a;
								s = s.return;
							}
							s.sibling.return = s.return, s = s.sibling;
						}
						t.stateNode = o;
						a: switch (np(o, a, r), a) {
							case "button":
							case "input":
							case "select":
							case "textarea":
								r = !!r.autoFocus;
								break a;
							case "img":
								r = !0;
								break a;
							default: r = !1;
						}
						r && dl(t);
					}
				}
				return gl(t), t.subtreeFlags &= -33554433, fl(t, t.type, e === null ? null : e.memoizedProps, t.pendingProps, n), null;
			case 6:
				if (e && t.stateNode != null) e.memoizedProps !== r && dl(t);
				else {
					if (typeof r != "string" && t.stateNode === null) throw Error(i(166));
					if (e = Ae.current, ca(t)) {
						if (e = t.stateNode, n = t.memoizedProps, r = null, a = ta, a !== null) switch (a.tag) {
							case 27:
							case 5: r = a.memoizedProps;
						}
						e[Et] = t, e = !!(e.nodeValue === n || r !== null && !0 === r.suppressHydrationWarning || ep(e.nodeValue, n)), e || aa(t, !0);
					} else e = lp(e).createTextNode(r), e[Et] = t, t.stateNode = e;
				}
				return gl(t), null;
			case 31:
				if (n = t.memoizedState, e === null || e.memoizedState !== null) {
					if (r = ca(t), n !== null) {
						if (e === null) {
							if (!r) throw Error(i(318));
							if (e = t.memoizedState, e = e === null ? null : e.dehydrated, !e) throw Error(i(557));
							e[Et] = t;
						} else la(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
						gl(t), e = !1;
					} else n = ua(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = n), e = !0;
					if (!e) return t.flags & 256 ? (Po(t), t) : (Po(t), null);
					if (t.flags & 128) throw Error(i(558));
				}
				return gl(t), null;
			case 13:
				if (r = t.memoizedState, e === null || e.memoizedState !== null && e.memoizedState.dehydrated !== null) {
					if (a = ca(t), r !== null && r.dehydrated !== null) {
						if (e === null) {
							if (!a) throw Error(i(318));
							if (a = t.memoizedState, a = a === null ? null : a.dehydrated, !a) throw Error(i(317));
							a[Et] = t;
						} else la(), !(t.flags & 128) && (t.memoizedState = null), t.flags |= 4;
						gl(t), a = !1;
					} else a = ua(), e !== null && e.memoizedState !== null && (e.memoizedState.hydrationErrors = a), a = !0;
					if (!a) return t.flags & 256 ? (Po(t), t) : (Po(t), null);
				}
				return Po(t), t.flags & 128 ? (t.lanes = n, t) : (n = r !== null, e = e !== null && e.memoizedState !== null, n && (r = t.child, a = null, r.alternate !== null && r.alternate.memoizedState !== null && r.alternate.memoizedState.cachePool !== null && (a = r.alternate.memoizedState.cachePool.pool), o = null, r.memoizedState !== null && r.memoizedState.cachePool !== null && (o = r.memoizedState.cachePool.pool), o !== a && (r.flags |= 2048)), n !== e && n && (t.child.flags |= 8192), ml(t, t.updateQueue), gl(t), null);
			case 4: return j(), e === null && Wf(t.stateNode.containerInfo), t.flags |= 67108864, gl(t), null;
			case 10: return ga(t.type), gl(t), null;
			case 19:
				if (Lo(t), r = t.memoizedState, r === null) return gl(t), null;
				if (a = !!(t.flags & 128), o = r.rendering, o === null) {
					if (a) hl(r, !1);
					else {
						if (ad !== 0 || e !== null && e.flags & 128) for (e = t.child; e !== null;) {
							if (o = Ro(e), o !== null) {
								for (t.flags |= 128, hl(r, !1), e = o.updateQueue, t.updateQueue = e, ml(t, e), t.subtreeFlags = 0, e = n, n = t.child; n !== null;) Ni(n, e), n = n.sibling;
								return Io(t, Fo.current & 1 | 2), U && Xi(t, r.treeForkCount), t.child;
							}
							e = e.sibling;
						}
						r.tail !== null && N() > gd && (t.flags |= 128, a = !0, hl(r, !1), t.lanes = 4194304);
					}
				} else {
					if (!a) {
						if (e = Ro(o), e !== null) {
							if (t.flags |= 128, a = !0, e = e.updateQueue, t.updateQueue = e, ml(t, e), hl(r, !0), r.tail === null && r.tailMode !== "collapsed" && r.tailMode !== "visible" && !o.alternate && !U) return gl(t), null;
						} else 2 * N() - r.renderingStartTime > gd && n !== 536870912 && (t.flags |= 128, a = !0, hl(r, !1), t.lanes = 4194304);
					}
					r.isBackwards ? (o.sibling = t.child, t.child = o) : (e = r.last, e === null ? t.child = o : e.sibling = o, r.last = o);
				}
				if (r.tail !== null) {
					e = r.tail;
					a: {
						for (n = e; n !== null;) {
							if (n.alternate !== null) {
								n = !1;
								break a;
							}
							n = n.sibling;
						}
						n = !0;
					}
					return r.rendering = e, r.tail = e.sibling, r.renderingStartTime = N(), e.sibling = null, o = Fo.current, o = a ? o & 1 | 2 : o & 1, r.tailMode === "visible" || r.tailMode === "collapsed" || !n || U ? Io(t, o) : (n = o, A(Oo, t), A(Fo, n), ko === null && (ko = t)), U && Xi(t, r.treeForkCount), e;
				}
				return gl(t), null;
			case 22:
			case 23: return Po(t), Do(), r = t.memoizedState !== null, e === null ? r && (t.flags |= 8192) : e.memoizedState !== null !== r && (t.flags |= 8192), r ? n & 536870912 && !(t.flags & 128) && (gl(t), t.subtreeFlags & 6 && (t.flags |= 8192)) : gl(t), n = t.updateQueue, n !== null && ml(t, n.retryQueue), n = null, e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), r = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (r = t.memoizedState.cachePool.pool), r !== n && (t.flags |= 2048), e !== null && k(Ha), null;
			case 24: return n = null, e !== null && (n = e.memoizedState.cache), t.memoizedState.cache !== n && (t.flags |= 2048), ga(Oa), gl(t), null;
			case 25: return null;
			case 30: return t.flags |= 33554432, gl(t), null;
		}
		throw Error(i(156, t.tag));
	}
	function vl(e, t) {
		switch ($i(t), t.tag) {
			case 1: return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 3: return ga(Oa), j(), e = t.flags, e & 65536 && !(e & 128) ? (t.flags = e & -65537 | 128, t) : null;
			case 26:
			case 27:
			case 5: return Pe(t), null;
			case 31:
				if (t.memoizedState !== null) {
					if (Po(t), t.alternate === null) throw Error(i(340));
					la();
				}
				return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 13:
				if (Po(t), e = t.memoizedState, e !== null && e.dehydrated !== null) {
					if (t.alternate === null) throw Error(i(340));
					la();
				}
				return e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 19: return Lo(t), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, e = t.memoizedState, e !== null && (e.rendering = null, e.tail = null), t.flags |= 4, t) : null;
			case 4: return j(), null;
			case 10: return ga(t.type), null;
			case 22:
			case 23: return Po(t), Do(), e !== null && k(Ha), e = t.flags, e & 65536 ? (t.flags = e & -65537 | 128, t) : null;
			case 24: return ga(Oa), null;
			case 25: return null;
			default: return null;
		}
	}
	function yl(e, t) {
		switch ($i(t), t.tag) {
			case 3:
				ga(Oa), j();
				break;
			case 26:
			case 27:
			case 5:
				Pe(t);
				break;
			case 4:
				j();
				break;
			case 31:
				t.memoizedState !== null && Po(t);
				break;
			case 13:
				Po(t);
				break;
			case 19:
				Lo(t);
				break;
			case 10:
				ga(t.type);
				break;
			case 22:
			case 23:
				Po(t), Do(), e !== null && k(Ha);
				break;
			case 24: ga(Oa);
		}
	}
	function bl(e, t) {
		try {
			var n = t.updateQueue, r = n === null ? null : n.lastEffect;
			if (r !== null) {
				var i = r.next;
				n = i;
				do {
					if ((n.tag & e) === e) {
						r = void 0;
						var a = n.create, o = n.inst;
						r = a(), o.destroy = r;
					}
					n = n.next;
				} while (n !== i);
			}
		} catch (e) {
			Z(t, t.return, e);
		}
	}
	function xl(e, t, n) {
		try {
			var r = t.updateQueue, i = r === null ? null : r.lastEffect;
			if (i !== null) {
				var a = i.next;
				r = a;
				do {
					if ((r.tag & e) === e) {
						var o = r.inst, s = o.destroy;
						if (s !== void 0) {
							o.destroy = void 0, i = t;
							var c = n, l = s;
							try {
								l();
							} catch (e) {
								Z(i, c, e);
							}
						}
					}
					r = r.next;
				} while (r !== a);
			}
		} catch (e) {
			Z(t, t.return, e);
		}
	}
	function Sl(e) {
		var t = e.updateQueue;
		if (t !== null) {
			var n = e.stateNode;
			try {
				So(t, n);
			} catch (t) {
				Z(e, e.return, t);
			}
		}
	}
	function Cl(e, t, n) {
		n.props = bc(e.type, e.memoizedProps), n.state = e.memoizedState;
		try {
			n.componentWillUnmount();
		} catch (n) {
			Z(e, t, n);
		}
	}
	function wl(e, t) {
		try {
			var n = e.ref;
			if (n !== null) {
				switch (e.tag) {
					case 26:
					case 27:
					case 5:
						var r = e.stateNode;
						break;
					case 30:
						var i = e.stateNode, a = hi(e.memoizedProps, i);
						(i.ref === null || i.ref.name !== a) && (i.ref = Pp(a)), r = i.ref;
						break;
					case 7:
						if (e.stateNode === null) {
							var o = new Fp(e);
							h(e.child, !1, Qp, o, void 0, void 0), e.stateNode = o;
						}
						r = e.stateNode;
						break;
					default: r = e.stateNode;
				}
				typeof n == "function" ? e.refCleanup = n(r) : n.current = r;
			}
		} catch (n) {
			Z(e, t, n);
		}
	}
	function Tl(e, t) {
		var n = e.ref, r = e.refCleanup;
		if (n !== null) {
			if (typeof r == "function") try {
				r();
			} catch (n) {
				Z(e, t, n);
			} finally {
				e.refCleanup = null, e = e.alternate, e != null && (e.refCleanup = null);
			}
			else if (typeof n == "function") try {
				n(null);
			} catch (n) {
				Z(e, t, n);
			}
			else n.current = null;
		}
	}
	function El(e, t) {
		if ((e.tag === 5 || e.tag === 27 || e.tag === 6) && e.alternate === null && t !== null) for (var n = 0; n < t.length; n++) em(e.stateNode, t[n]);
	}
	function Dl(e) {
		for (var t = e.return; t !== null && (Al(t) && em(e.stateNode, t.stateNode), !kl(t));) t = t.return;
	}
	function Ol(e) {
		for (var t = e.return; t !== null && (Al(t) && tm(e.stateNode, t.stateNode), !kl(t));) t = t.return;
	}
	function kl(e) {
		return e.tag === 5 || e.tag === 3 || e.tag === 27;
	}
	function Al(e) {
		return e && e.tag === 7 && e.stateNode !== null;
	}
	function jl(e) {
		var t = e.type, n = e.memoizedProps, r = e.stateNode;
		try {
			a: switch (t) {
				case "button":
				case "input":
				case "select":
				case "textarea":
					n.autoFocus && r.focus();
					break a;
				case "img": n.src ? r.src = n.src : n.srcSet && (r.srcset = n.srcSet);
			}
		} catch (t) {
			Z(e, e.return, t);
		}
	}
	function Ml(e, t, n) {
		try {
			var r = e.stateNode;
			ip(r, e.type, n, t), r[Dt] = t;
		} catch (t) {
			Z(e, e.return, t);
		}
	}
	function Nl(e) {
		return e.tag === 5 || e.tag === 3 || e.tag === 26 || e.tag === 27 && Sp(e.type) || e.tag === 4;
	}
	function Pl(e) {
		a: for (;;) {
			for (; e.sibling === null;) {
				if (e.return === null || Nl(e.return)) return null;
				e = e.return;
			}
			for (e.sibling.return = e.return, e = e.sibling; e.tag !== 5 && e.tag !== 6 && e.tag !== 18;) {
				if (e.tag === 27 && Sp(e.type) || e.flags & 2 || e.child === null || e.tag === 4) continue a;
				e.child.return = e, e = e.child;
			}
			if (!(e.flags & 2)) return e.stateNode;
		}
	}
	function Fl(e, t, n, r) {
		var i = e.tag;
		if (i === 5 || i === 6) i = e.stateNode, t ? (n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n).insertBefore(i, t) : (t = n.nodeType === 9 ? n.body : n.nodeName === "HTML" ? n.ownerDocument.body : n, t.appendChild(i), n = n._reactRootContainer, n != null || t.onclick !== null || (t.onclick = R)), El(e, r), F = !0;
		else if (i !== 4 && (i === 27 && (El(e, r), r = null, Sp(e.type) && (n = e.stateNode, t = null)), e = e.child, e !== null)) for (Fl(e, t, n, r), e = e.sibling; e !== null;) Fl(e, t, n, r), e = e.sibling;
	}
	function Il(e, t, n, r) {
		var i = e.tag;
		if (i === 5 || i === 6) i = e.stateNode, t ? n.insertBefore(i, t) : n.appendChild(i), El(e, r), F = !0;
		else if (i !== 4 && (i === 27 && (El(e, r), r = null, Sp(e.type) && (n = e.stateNode)), e = e.child, e !== null)) for (Il(e, t, n, r), e = e.sibling; e !== null;) Il(e, t, n, r), e = e.sibling;
	}
	function Ll(e) {
		var t = e.stateNode, n = e.memoizedProps;
		try {
			for (var r = e.type, i = t.attributes; i.length;) t.removeAttributeNode(i[0]);
			np(t, r, n), t[Et] = e, t[Dt] = n;
		} catch (t) {
			Z(e, e.return, t);
		}
	}
	var Rl = !1, zl = null;
	function Bl(e) {
		(e.tag === 30 || e.subtreeFlags & 33554432) && (Rl = !0);
	}
	var Vl = null;
	function Hl() {
		var e = Vl;
		return Vl = null, e;
	}
	var Ul = 0;
	function Wl(e, t, n, r, i) {
		return Ul = 0, Gl(e.child, t, n, r, i);
	}
	function Gl(e, t, n, r, i) {
		for (var a = !1; e !== null;) {
			if (e.tag === 5) {
				var o = e.stateNode;
				if (r !== null) {
					var s = Op(o);
					r.push(s), s.view && (a = !0);
				} else a || Op(o).view && (a = !0);
				Rl = !0, Tp(o, Ul === 0 ? t : t + "_" + Ul, n), Ul++;
			} else e.tag === 22 && e.memoizedState !== null || e.tag === 30 && i || Gl(e.child, t, n, r, i) && (a = !0);
			e = e.sibling;
		}
		return a;
	}
	function Kl(e, t) {
		for (; e !== null;) e.tag === 5 ? Ep(e.stateNode, e.memoizedProps) : e.tag === 22 && e.memoizedState !== null || e.tag === 30 && t || Kl(e.child, t), e = e.sibling;
	}
	function ql(e) {
		if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
			if ((e.tag !== 22 || e.memoizedState === null) && (ql(e), e.tag === 30 && e.flags & 18874368 && e.stateNode.paired)) {
				var t = e.memoizedProps;
				if (t.name == null || t.name === "auto") throw Error(i(544));
				var n = t.name;
				t = _i(t.default, t.share), t !== "none" && (Wl(e, n, t, null, !1) || Kl(e.child, !1));
			}
			e = e.sibling;
		}
	}
	function Jl(e, t) {
		if (e.tag === 30) {
			var n = e.stateNode, r = e.memoizedProps, i = hi(r, n), a = _i(r.default, n.paired ? r.share : r.enter);
			a === "none" ? ql(e) : Wl(e, i, a, null, !1) ? (ql(e), n.paired || t || Nd(e, r.onEnter)) : Kl(e.child, !1);
		} else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) Jl(e, t), e = e.sibling;
		else ql(e);
	}
	function Yl(e) {
		if (zl !== null && zl.size !== 0) {
			var t = zl;
			if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
				if (e.tag !== 22 || e.memoizedState === null) {
					if (e.tag === 30 && e.flags & 18874368) {
						var n = e.memoizedProps, r = n.name;
						if (r != null && r !== "auto") {
							var i = t.get(r);
							if (i !== void 0) {
								var a = _i(n.default, n.share);
								if (a !== "none" && (Wl(e, r, a, null, !1) ? (a = e.stateNode, i.paired = a, a.paired = i, Nd(e, n.onShare)) : Kl(e.child, !1)), t.delete(r), t.size === 0) break;
							}
						}
					}
					Yl(e);
				}
				e = e.sibling;
			}
		}
	}
	function Xl(e) {
		if (e.tag === 30) {
			var t = e.memoizedProps, n = hi(t, e.stateNode), r = zl === null ? void 0 : zl.get(n), i = _i(t.default, r === void 0 ? t.exit : t.share);
			i !== "none" && (Wl(e, n, i, null, !1) ? r === void 0 ? Nd(e, t.onExit) : (i = e.stateNode, r.paired = i, i.paired = r, zl.delete(n), Nd(e, t.onShare)) : Kl(e.child, !1)), zl !== null && Yl(e);
		} else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) Xl(e), e = e.sibling;
		else zl !== null && Yl(e);
	}
	function Zl(e) {
		for (e = e.child; e !== null;) {
			if (e.tag === 30) {
				var t = e.memoizedProps, n = hi(t, e.stateNode);
				t = _i(t.default, t.update), e.flags &= -5, t !== "none" && Wl(e, n, t, e.memoizedState = [], !1);
			} else e.subtreeFlags & 33554432 && Zl(e);
			e = e.sibling;
		}
	}
	function Ql(e) {
		if (e.subtreeFlags & 18874368) for (e = e.child; e !== null;) {
			if (e.tag !== 22 || e.memoizedState === null) {
				if (e.tag === 30 && e.flags & 18874368) {
					var t = e.stateNode;
					t.paired !== null && (t.paired = null, Kl(e.child, !1));
				}
				Ql(e);
			}
			e = e.sibling;
		}
	}
	function $l(e) {
		if (e.tag === 30) e.stateNode.paired = null, Kl(e.child, !1), Ql(e);
		else if (e.subtreeFlags & 33554432) for (e = e.child; e !== null;) $l(e), e = e.sibling;
		else Ql(e);
	}
	function eu(e) {
		for (e = e.child; e !== null;) e.tag === 30 ? Kl(e.child, !1) : e.subtreeFlags & 33554432 && eu(e), e = e.sibling;
	}
	function tu(e, t, n, r, i, a, o) {
		for (var s = !1; t !== null;) {
			if (t.tag === 5) {
				var c = t.stateNode;
				if (a !== null && Ul < a.length) {
					var l = a[Ul], u = Op(c);
					(l.view || u.view) && (s = !0);
					var d;
					if (d = !(e.flags & 4)) {
						if (u.clip) d = !0;
						else {
							d = l.rect;
							var f = u.rect;
							d = d.y !== f.y || d.x !== f.x || d.height !== f.height || d.width !== f.width;
						}
					}
					d && (e.flags |= 4), u.abs ? u = !l.abs : (l = l.rect, u = u.rect, u = l.height !== u.height || l.width !== u.width), u && (e.flags |= 32);
				} else e.flags |= 32;
				e.flags & 4 && Tp(c, Ul === 0 ? n : n + "_" + Ul, i), s && e.flags & 4 || (Vl === null && (Vl = []), Vl.push(c, Ul === 0 ? r : r + "_" + Ul, t.memoizedProps)), Ul++;
			} else (t.tag !== 22 || t.memoizedState === null) && (t.tag === 30 && o ? e.flags |= t.flags & 32 : tu(e, t.child, n, r, i, a, o) && (s = !0));
			t = t.sibling;
		}
		return s;
	}
	function nu(e, t) {
		for (e = e.child; e !== null;) {
			if (e.tag === 30) {
				var n = e.memoizedProps, r = e.stateNode, i = hi(n, r), a = _i(n.default, n.update);
				if (t) {
					r = r.clones;
					var o = r === null ? null : r.map(kp);
				} else o = e.memoizedState, e.memoizedState = null;
				r = e;
				var s = e.child;
				Ul = 0, i = tu(r, s, i, i, a, o, !1), e.flags & 4 && i && (t || Nd(e, n.onUpdate));
			} else e.subtreeFlags & 33554432 && nu(e, t);
			e = e.sibling;
		}
	}
	var ru = !1, K = !1, iu = !1, au = !1, ou = typeof WeakSet == "function" ? WeakSet : Set, su = null, cu = !1, lu = !1, uu = !1, du = !1;
	function fu(e, t, n) {
		if (e = e.containerInfo, sp = gh, e = Gr(e), Kr(e)) {
			if ("selectionStart" in e) var r = {
				start: e.selectionStart,
				end: e.selectionEnd
			};
			else a: {
				r = (r = e.ownerDocument) && r.defaultView || window;
				var i = r.getSelection && r.getSelection();
				if (i && i.rangeCount !== 0) {
					r = i.anchorNode;
					var a = i.anchorOffset, o = i.focusNode;
					i = i.focusOffset;
					try {
						r.nodeType, o.nodeType;
					} catch {
						r = null;
						break a;
					}
					var s = 0, c = -1, l = -1, u = 0, d = 0, f = e, p = null;
					b: for (;;) {
						for (var m; f !== r || a !== 0 && f.nodeType !== 3 || (c = s + a), f !== o || i !== 0 && f.nodeType !== 3 || (l = s + i), f.nodeType === 3 && (s += f.nodeValue.length), (m = f.firstChild) !== null;) p = f, f = m;
						for (;;) {
							if (f === e) break b;
							if (p === r && ++u === a && (c = s), p === o && ++d === i && (l = s), (m = f.nextSibling) !== null) break;
							f = p, p = f.parentNode;
						}
						f = m;
					}
					r = c === -1 || l === -1 ? null : {
						start: c,
						end: l
					};
				} else r = null;
			}
			r ||= {
				start: 0,
				end: 0
			};
		} else r = null;
		for (cp = {
			focusedElem: e,
			selectionRange: r
		}, gh = !1, n = (n & 335544064) === n, su = t, t = n ? 9270 : 1024; su !== null;) {
			if (e = su, n && (r = e.deletions, r !== null)) for (a = 0; a < r.length; a++) n && Xl(r[a]);
			if (e.alternate === null && e.flags & 2) n && Bl(e), pu(n);
			else {
				if (e.tag === 22) {
					if (r = e.alternate, e.memoizedState !== null) {
						r !== null && r.memoizedState === null && n && Xl(r), pu(n);
						continue;
					}
					if (r !== null && r.memoizedState !== null) {
						n && Bl(e), pu(n);
						continue;
					}
				}
				r = e.child, (e.subtreeFlags & t) !== 0 && r !== null ? (r.return = e, su = r) : (n && Zl(e), pu(n));
			}
		}
		zl = null;
	}
	function pu(e) {
		for (; su !== null;) {
			var t = su, n = e, r = t.alternate, a = t.flags;
			switch (t.tag) {
				case 0:
				case 11:
				case 15: break;
				case 1:
					if (a & 1024 && r !== null) {
						n = void 0, a = r.memoizedProps, r = r.memoizedState;
						var o = t.stateNode;
						try {
							var s = bc(t.type, a);
							n = o.getSnapshotBeforeUpdate(s, r), o.__reactInternalSnapshotBeforeUpdate = n;
						} catch (e) {
							Z(t, t.return, e);
						}
					}
					break;
				case 3:
					if (a & 1024) {
						if (r = t.stateNode.containerInfo, n = r.nodeType, n === 9) nm(r);
						else if (n === 1) switch (r.nodeName) {
							case "HEAD":
							case "HTML":
							case "BODY":
								nm(r);
								break;
							default: r.textContent = "";
						}
					}
					break;
				case 5:
				case 26:
				case 27:
				case 6:
				case 4:
				case 17: break;
				case 30:
					n && r !== null && (n = hi(r.memoizedProps, r.stateNode), a = t.memoizedProps, a = _i(a.default, a.update), a !== "none" && Wl(r, n, a, r.memoizedState = [], !0));
					break;
				default: if (a & 1024) throw Error(i(163));
			}
			if (r = t.sibling, r !== null) {
				r.return = t.return, su = r;
				break;
			}
			su = t.return;
		}
	}
	function mu(e, t, n) {
		var r = n.flags;
		switch (n.tag) {
			case 0:
			case 11:
			case 15:
				Pu(e, n), r & 4 && bl(5, n);
				break;
			case 1:
				if (Pu(e, n), r & 4) {
					if (e = n.stateNode, t === null) try {
						e.componentDidMount();
					} catch (e) {
						Z(n, n.return, e);
					}
					else {
						var i = bc(n.type, t.memoizedProps);
						t = t.memoizedState;
						try {
							e.componentDidUpdate(i, t, e.__reactInternalSnapshotBeforeUpdate);
						} catch (e) {
							Z(n, n.return, e);
						}
					}
				}
				r & 64 && Sl(n), r & 512 && wl(n, n.return);
				break;
			case 3:
				if (Pu(e, n), r & 64 && (e = n.updateQueue, e !== null)) {
					if (t = null, n.child !== null) switch (n.child.tag) {
						case 27:
						case 5:
							t = n.child.stateNode;
							break;
						case 1: t = n.child.stateNode;
					}
					try {
						So(e, t);
					} catch (e) {
						Z(n, n.return, e);
					}
				}
				break;
			case 27: t === null && r & 4 && Ll(n);
			case 26:
			case 5:
				Pu(e, n), t === null && r & 4 && jl(n), r & 512 && wl(n, n.return);
				break;
			case 12:
				Pu(e, n);
				break;
			case 31:
				Pu(e, n), r & 4 && Cu(e, n);
				break;
			case 13:
				Pu(e, n), r & 4 && wu(e, n), r & 64 && (e = n.memoizedState, e !== null && (e = e.dehydrated, e !== null && (n = _f.bind(null, n), cm(e, n))));
				break;
			case 22:
				if (r = n.memoizedState !== null || ru, !r) {
					var a = t !== null && t.memoizedState !== null || K;
					t = ru, i = K, ru = r, (K = a) && !i ? (r = 2, n.subtreeFlags & 8772 && (r |= 1), Iu(e, n, r)) : Pu(e, n), ru = t, K = i;
				}
				break;
			case 30:
				Pu(e, n), r & 512 && wl(n, n.return);
				break;
			case 7: r & 512 && wl(n, n.return);
			default: Pu(e, n);
		}
	}
	function hu(e, t) {
		for (e = e.child; e !== null;) gu(e, t), e = e.sibling;
	}
	function gu(e, t) {
		switch (e.tag) {
			case 5:
			case 26:
				try {
					var n = e.stateNode;
					if (t) {
						var r = n.style;
						typeof r.setProperty == "function" ? r.setProperty("display", "none", "important") : r.display = "none";
					} else {
						var i = e.stateNode, a = e.memoizedProps.style, o = a != null && a.hasOwnProperty("display") ? a.display : null;
						i.style.display = o == null || typeof o == "boolean" ? "" : ("" + o).trim();
					}
				} catch (t) {
					Z(e, e.return, t);
				}
				_u(e, t);
				break;
			case 6:
				try {
					e.stateNode.nodeValue = t ? "" : e.memoizedProps, F = !0;
				} catch (t) {
					Z(e, e.return, t);
				}
				break;
			case 18:
				try {
					var s = e.stateNode;
					t ? wp(s, !0) : wp(e.stateNode, !1);
				} catch (t) {
					Z(e, e.return, t);
				}
				break;
			case 22:
			case 23:
				e.memoizedState === null && hu(e, t);
				break;
			default: hu(e, t);
		}
	}
	function _u(e, t) {
		if (e.subtreeFlags & 67108864) for (e = e.child; e !== null;) {
			a: {
				var n = e, r = t;
				switch (n.tag) {
					case 4:
						gu(n, r);
						break a;
					case 22:
						n.memoizedState === null && _u(n, r);
						break a;
					default: _u(n, r);
				}
			}
			e = e.sibling;
		}
	}
	function vu(e) {
		var t = e.alternate;
		t !== null && (e.alternate = null, vu(t)), e.child = null, e.deletions = null, e.sibling = null, e.tag === 5 && (t = e.stateNode, t !== null && Ft(t)), e.stateNode = null, e.return = null, e.dependencies = null, e.memoizedProps = null, e.memoizedState = null, e.pendingProps = null, e.stateNode = null, e.updateQueue = null;
	}
	var yu = null, bu = !1;
	function xu(e, t, n) {
		for (n = n.child; n !== null;) Su(e, t, n), n = n.sibling;
	}
	function Su(e, t, n) {
		if (P && typeof P.onCommitFiberUnmount == "function") try {
			P.onCommitFiberUnmount(et, n);
		} catch {}
		switch (n.tag) {
			case 26:
				K || Tl(n, t), xu(e, t, n), n.memoizedState ? n.memoizedState.count-- : n.stateNode && !K && (n = n.stateNode, n.parentNode.removeChild(n));
				break;
			case 27:
				K || Tl(n, t), Ol(n);
				var r = yu, i = bu;
				Sp(n.type) && (yu = n.stateNode, bu = !1), xu(e, t, n), gm(n.stateNode, n.type, n.memoizedProps), yu = r, bu = i;
				break;
			case 5: K || Tl(n, t), Ol(n);
			case 6:
				if (n.tag === 6 && Ol(n), r = yu, i = bu, yu = null, xu(e, t, n), yu = r, bu = i, yu !== null) {
					if (bu) try {
						(yu.nodeType === 9 ? yu.body : yu.nodeName === "HTML" ? yu.ownerDocument.body : yu).removeChild(n.stateNode), F = !0;
					} catch (e) {
						Z(n, t, e);
					}
					else try {
						yu.removeChild(n.stateNode), F = !0;
					} catch (e) {
						Z(n, t, e);
					}
				}
				break;
			case 18:
				yu !== null && (bu ? (e = yu, Cp(e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, n.stateNode), Hh(e)) : Cp(yu, n.stateNode));
				break;
			case 4:
				r = yu, i = bu, yu = n.stateNode.containerInfo, bu = !0, xu(e, t, n), yu = r, bu = i;
				break;
			case 0:
			case 11:
			case 14:
			case 15:
				xl(2, n, t), K || xl(4, n, t), xu(e, t, n);
				break;
			case 1:
				K || (Tl(n, t), r = n.stateNode, typeof r.componentWillUnmount == "function" && Cl(n, t, r)), xu(e, t, n);
				break;
			case 21:
				xu(e, t, n);
				break;
			case 22:
				K = (r = K) || n.memoizedState !== null, xu(e, t, n), K = r;
				break;
			case 30:
				Tl(n, t), xu(e, t, n);
				break;
			case 7:
				K || Tl(n, t), xu(e, t, n);
				break;
			default: xu(e, t, n);
		}
	}
	function Cu(e, t) {
		if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null))) {
			e = e.dehydrated;
			try {
				Hh(e);
			} catch (e) {
				Z(t, t.return, e);
			}
		}
	}
	function wu(e, t) {
		if (t.memoizedState === null && (e = t.alternate, e !== null && (e = e.memoizedState, e !== null && (e = e.dehydrated, e !== null)))) try {
			Hh(e);
		} catch (e) {
			Z(t, t.return, e);
		}
	}
	function Tu(e) {
		switch (e.tag) {
			case 31:
			case 13:
			case 19:
				var t = e.stateNode;
				return t === null && (t = e.stateNode = new ou()), t;
			case 22: return e = e.stateNode, t = e._retryCache, t === null && (t = e._retryCache = new ou()), t;
			default: throw Error(i(435, e.tag));
		}
	}
	function Eu(e, t) {
		var n = Tu(e);
		t.forEach(function(t) {
			if (!n.has(t)) {
				n.add(t);
				var r = vf.bind(null, e, t);
				t.then(r, r);
			}
		});
	}
	function Du(e, t, n) {
		var r = t.deletions;
		if (r !== null) for (var a = 0; a < r.length; a++) {
			var o = r[a], s = e, c = t, l = c;
			a: for (; l !== null;) {
				switch (l.tag) {
					case 27:
						if (Sp(l.type)) {
							yu = l.stateNode, bu = !1;
							break a;
						}
						break;
					case 5:
						yu = l.stateNode, bu = !1;
						break a;
					case 3:
					case 4:
						yu = l.stateNode.containerInfo, bu = !0;
						break a;
				}
				l = l.return;
			}
			if (yu === null) throw Error(i(160));
			Su(s, c, o), yu = null, bu = !1, s = o.alternate, s !== null && (s.return = null), o.return = null;
		}
		if (t.subtreeFlags & 13886) for (t = t.child; t !== null;) ku(t, e, n), t = t.sibling;
	}
	var Ou = null;
	function ku(e, t, n) {
		var r = e.alternate, a = e.flags;
		switch (e.tag) {
			case 0:
			case 11:
			case 14:
			case 15:
				if (a & 4 && (r = e.updateQueue, r = r === null ? null : r.events, r !== null)) for (var o = 0; o < r.length; o++) {
					var s = r[o];
					s.ref.impl = s.nextImpl;
				}
				Du(t, e, n), Au(e), a & 4 && (xl(3, e, e.return), bl(3, e), xl(5, e, e.return));
				break;
			case 1:
				Du(t, e, n), Au(e), a & 512 && (K || r === null || Tl(r, r.return)), a & 64 && ru && (e = e.updateQueue, e !== null && (t = e.callbacks, t !== null && (n = e.shared.hiddenCallbacks, e.shared.hiddenCallbacks = n === null ? t : n.concat(t))));
				break;
			case 26:
				if (o = Ou, Du(t, e, n), Au(e), a & 512 && (K || r === null || Tl(r, r.return)), a & 4) {
					if (a = r === null ? null : r.memoizedState, n = e.memoizedState, r === null) {
						if (n === null) {
							if (e.stateNode === null) {
								if (ru) e.stateNode = fp(e.type, e.memoizedProps, t.containerInfo, e);
								else {
									a: {
										t = e.type, n = e.memoizedProps, a = o.ownerDocument || o;
										b: switch (t) {
											case "title":
												r = a.getElementsByTagName("title")[0], (!r || r[Nt] || r[Et] || r.namespaceURI === "http://www.w3.org/2000/svg" || r.hasAttribute("itemprop")) && (r = a.createElement(t), a.head.insertBefore(r, a.querySelector("head > title"))), np(r, t, n), r[Et] = e, Bt(r), t = r;
												break a;
											case "link":
												if (o = Gm("link", "href", a).get(t + (n.href || ""))) {
													for (s = 0; s < o.length; s++) if (r = o[s], r.getAttribute("href") === (n.href == null || n.href === "" ? null : n.href) && r.getAttribute("rel") === (n.rel == null ? null : n.rel) && r.getAttribute("title") === (n.title == null ? null : n.title) && r.getAttribute("crossorigin") === (n.crossOrigin == null ? null : n.crossOrigin)) {
														o.splice(s, 1);
														break b;
													}
												}
												r = a.createElement(t), np(r, t, n), a.head.appendChild(r);
												break;
											case "meta":
												if (o = Gm("meta", "content", a).get(t + (n.content || ""))) {
													for (s = 0; s < o.length; s++) if (r = o[s], r.getAttribute("content") === (n.content == null ? null : "" + n.content) && r.getAttribute("name") === (n.name == null ? null : n.name) && r.getAttribute("property") === (n.property == null ? null : n.property) && r.getAttribute("http-equiv") === (n.httpEquiv == null ? null : n.httpEquiv) && r.getAttribute("charset") === (n.charSet == null ? null : n.charSet)) {
														o.splice(s, 1);
														break b;
													}
												}
												r = a.createElement(t), np(r, t, n), a.head.appendChild(r);
												break;
											default: throw Error(i(468, t));
										}
										r[Et] = e, Bt(r), t = r;
									}
									e.stateNode = t;
								}
							} else ru || Km(o, e.type, e.stateNode);
						} else e.stateNode = Bm(o, n, e.memoizedProps);
					} else a === n ? n === null && e.stateNode !== null && Ml(e, e.memoizedProps, r.memoizedProps) : (a === null ? (t = r.stateNode, t === null || K || t.parentNode.removeChild(t)) : a.count--, n === null ? ru || Km(o, e.type, e.stateNode) : Bm(o, n, e.memoizedProps));
				}
				break;
			case 27:
				Du(t, e, n), Au(e), a & 512 && (K || r === null || Tl(r, r.return)), r !== null && a & 4 && Ml(e, e.memoizedProps, r.memoizedProps);
				break;
			case 5:
				if (o = iu, iu = !1, Du(t, e, n), iu = o, Au(e), a & 512 && (K || r === null || Tl(r, r.return)), e.flags & 32) {
					t = e.stateNode;
					try {
						mn(t, ""), F = !0;
					} catch (t) {
						Z(e, e.return, t);
					}
				}
				a & 4 && e.stateNode != null && (t = e.memoizedProps, Ml(e, t, r === null ? t : r.memoizedProps)), a & 1024 && (au = !0);
				break;
			case 6:
				if (Du(t, e, n), Au(e), a & 4) {
					if (e.stateNode === null) throw Error(i(162));
					t = e.memoizedProps, n = e.stateNode;
					try {
						n.nodeValue = t, F = !0;
					} catch (t) {
						Z(e, e.return, t);
					}
				}
				break;
			case 3:
				if (F = !1, Wm = null, o = Ou, Ou = bm(t.containerInfo), Du(t, e, n), Ou = o, Au(e), a & 4 && r !== null && r.memoizedState.isDehydrated) try {
					Hh(t.containerInfo);
				} catch (t) {
					Z(e, e.return, t);
				}
				au && (au = !1, ju(e)), F = !1;
				break;
			case 4:
				a = iu, iu = ru, r = Xt(), o = Ou, Ou = bm(e.stateNode.containerInfo), Du(t, e, n), Au(e), Ou = o, F && lu && (uu = !0), F = r, iu = a;
				break;
			case 12:
				Du(t, e, n), Au(e);
				break;
			case 31:
				Du(t, e, n), Au(e), a & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Eu(e, t)));
				break;
			case 13:
				Du(t, e, n), Au(e), e.child.flags & 8192 && e.memoizedState !== null != (r !== null && r.memoizedState !== null) && (md = N()), a & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Eu(e, t)));
				break;
			case 22:
				o = e.memoizedState !== null, s = r !== null && r.memoizedState !== null;
				var c = ru, l = K, u = iu;
				ru = c || o, iu = u || o, K = l || s, Du(t, e, n), K = l, iu = u, ru = c, Au(e), a & 8192 && (t = e.stateNode, t._visibility = o ? t._visibility & -2 : t._visibility | 1, !o || r === null || s || ru || K || (t = s || K, n = ru, r = K, ru = o || ru, K = t, Fu(e, 2), ru = n, K = r), !o && iu || hu(e, o)), a & 4 && (t = e.updateQueue, t !== null && (n = t.retryQueue, n !== null && (t.retryQueue = null, Eu(e, n))));
				break;
			case 19:
				Du(t, e, n), Au(e), a & 4 && (t = e.updateQueue, t !== null && (e.updateQueue = null, Eu(e, t)));
				break;
			case 30:
				a & 512 && (K || r === null || Tl(r, r.return)), a = Xt(), o = lu, s = (n & 335544064) === n, c = e.memoizedProps, lu = s && _i(c.default, c.update) !== "none", Du(t, e, n), Au(e), s && r !== null && F && (e.flags |= 4), lu = o, F = a;
				break;
			case 21: break;
			case 7: a & 512 && (K || r === null || Tl(r, r.return)), r && r.stateNode !== null && (r.stateNode._fragmentFiber = e);
			default: Du(t, e, n), Au(e);
		}
	}
	function Au(e) {
		var t = e.flags;
		if (t & 2) {
			try {
				for (var n, r = e.return; r !== null;) {
					if (Nl(r)) {
						n = r;
						break;
					}
					r = r.return;
				}
				r = null;
				for (var a = e.return; a !== null;) {
					if (Al(a)) {
						var o = a.stateNode;
						r === null ? r = [o] : r.push(o);
					}
					if (kl(a)) break;
					a = a.return;
				}
				var s = r;
				if (n == null) throw Error(i(160));
				switch (n.tag) {
					case 27:
						var c = n.stateNode;
						Il(e, Pl(e), c, s);
						break;
					case 5:
						var l = n.stateNode;
						n.flags & 32 && (mn(l, ""), n.flags &= -33), Il(e, Pl(e), l, s);
						break;
					case 3:
					case 4:
						var u = n.stateNode.containerInfo;
						Fl(e, Pl(e), u, s);
						break;
					default: throw Error(i(161));
				}
			} catch (t) {
				Z(e, e.return, t);
			}
			e.flags &= -3;
		}
		t & 4096 && (e.flags &= -4097);
	}
	function ju(e) {
		if (e.subtreeFlags & 1024) for (e = e.child; e !== null;) {
			var t = e;
			ju(t), t.tag === 5 && t.flags & 1024 && (t = t.stateNode, gh = !0, t.reset(), gh = !1), e = e.sibling;
		}
	}
	function Mu(e, t) {
		if (t.subtreeFlags & 9270) for (t = t.child; t !== null;) Nu(t, e), t = t.sibling;
		else nu(t, !1);
	}
	function Nu(e, t) {
		var n = e.alternate;
		if (n === null) Jl(e, !1);
		else switch (e.tag) {
			case 3:
				if (du = cu = !1, Hl(), Mu(t, e), !cu && !uu) {
					if (e = Vl, e !== null) for (var r = 0; r < e.length; r += 3) {
						n = e[r];
						var i = e[r + 1];
						Ep(n, e[r + 2]), n = n.ownerDocument.documentElement, n !== null && n.animate({
							opacity: [0, 0],
							pointerEvents: ["none", "none"]
						}, {
							duration: 0,
							fill: "forwards",
							pseudoElement: "::view-transition-group(" + i + ")"
						});
					}
					e = t.containerInfo, e = e.nodeType === 9 ? e.documentElement : e.ownerDocument.documentElement, e !== null && e.style.viewTransitionName === "" && (e.style.viewTransitionName = "none", e.animate({
						opacity: [0, 0],
						pointerEvents: ["none", "none"]
					}, {
						duration: 0,
						fill: "forwards",
						pseudoElement: "::view-transition-group(root)"
					}), e.animate({
						width: [0, 0],
						height: [0, 0]
					}, {
						duration: 0,
						fill: "forwards",
						pseudoElement: "::view-transition"
					})), du = !0;
				}
				Vl = null;
				break;
			case 5:
				Mu(t, e);
				break;
			case 4:
				r = cu, cu = !1, Mu(t, e), cu && (uu = !0), cu = r;
				break;
			case 22:
				e.memoizedState === null && (n.memoizedState === null ? Mu(t, e) : Jl(e, !1));
				break;
			case 30:
				r = cu, i = Hl(), cu = !1, Mu(t, e), cu && (e.flags |= 4);
				var a = e.memoizedProps, o = e.stateNode;
				t = hi(a, o), o = hi(n.memoizedProps, o);
				var s = _i(a.default, a.update);
				s === "none" ? t = !1 : (a = n.memoizedState, n.memoizedState = null, n = e.child, Ul = 0, t = tu(e, n, t, o, s, a, !0), Ul !== (a === null ? 0 : a.length) && (e.flags |= 32)), e.flags & 4 && t ? (Nd(e, e.memoizedProps.onUpdate), Vl = i) : i !== null && (i.push.apply(i, Vl), Vl = i), cu = e.flags & 32 ? !0 : r;
				break;
			default: Mu(t, e);
		}
	}
	function Pu(e, t) {
		if (t.subtreeFlags & 8772) for (t = t.child; t !== null;) mu(e, t.alternate, t), t = t.sibling;
	}
	function Fu(e, t) {
		for (e = e.child; e !== null;) {
			var n = e, r = t;
			switch (n.tag) {
				case 0:
				case 11:
				case 14:
				case 15:
					xl(4, n, n.return), Fu(n, r);
					break;
				case 1:
					Tl(n, n.return);
					var i = n.stateNode;
					typeof i.componentWillUnmount == "function" && Cl(n, n.return, i), Fu(n, r);
					break;
				case 27: r & 2 && gm(n.stateNode, n.type, n.memoizedProps);
				case 5:
					Tl(n, n.return), n.tag !== 5 && n.tag !== 27 || Ol(n), Fu(n, r);
					break;
				case 6:
					Ol(n);
					break;
				case 26:
					Tl(n, n.return), i = n.stateNode, n.memoizedState !== null || i === null || K || i.parentNode.removeChild(i), Fu(n, r);
					break;
				case 22:
					n.memoizedState === null && Fu(n, r);
					break;
				case 30:
					Tl(n, n.return), Fu(n, r);
					break;
				case 7: Tl(n, n.return);
				default: Fu(n, r);
			}
			e = e.sibling;
		}
	}
	function Iu(e, t, n) {
		for (n = t.subtreeFlags & 8772 ? n : n & -2, t = t.child; t !== null;) {
			var r = t.alternate, i = e, a = t, o = a.flags, s = !!(n & 1);
			switch (a.tag) {
				case 0:
				case 11:
				case 15:
					Iu(i, a, n), bl(4, a);
					break;
				case 1:
					if (Iu(i, a, n), r = a, i = r.stateNode, typeof i.componentDidMount == "function") try {
						i.componentDidMount();
					} catch (e) {
						Z(r, r.return, e);
					}
					if (r = a, i = r.updateQueue, i !== null) {
						var c = r.stateNode;
						try {
							var l = i.shared.hiddenCallbacks;
							if (l !== null) for (i.shared.hiddenCallbacks = null, i = 0; i < l.length; i++) xo(l[i], c);
						} catch (e) {
							Z(r, r.return, e);
						}
					}
					s && o & 64 && Sl(a), wl(a, a.return);
					break;
				case 27: n & 2 && Ll(a);
				case 5:
					a.tag !== 5 && a.tag !== 27 || Dl(a), Iu(i, a, n), s && r === null && o & 4 && jl(a), wl(a, a.return);
					break;
				case 6:
					Dl(a);
					break;
				case 26:
					c = a.stateNode, a.memoizedState !== null || c === null || ru || Km(bm(c.ownerDocument), a.type, c), Iu(i, a, n), s && r === null && o & 4 && jl(a), wl(a, a.return);
					break;
				case 12:
					Iu(i, a, n);
					break;
				case 31:
					Iu(i, a, n), s && o & 4 && Cu(i, a);
					break;
				case 13:
					Iu(i, a, n), s && o & 4 && wu(i, a);
					break;
				case 22:
					a.memoizedState === null && Iu(i, a, n), wl(a, a.return);
					break;
				case 30:
					Iu(i, a, n), wl(a, a.return);
					break;
				case 7: wl(a, a.return);
				default: Iu(i, a, n);
			}
			t = t.sibling;
		}
	}
	function Lu(e, t) {
		var n = null;
		e !== null && e.memoizedState !== null && e.memoizedState.cachePool !== null && (n = e.memoizedState.cachePool.pool), e = null, t.memoizedState !== null && t.memoizedState.cachePool !== null && (e = t.memoizedState.cachePool.pool), e !== n && (e != null && e.refCount++, n != null && Aa(n));
	}
	function Ru(e, t) {
		e = null, t.alternate !== null && (e = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== e && (t.refCount++, e != null && Aa(e));
	}
	function zu(e, t, n, r) {
		var i = (n & 335544064) === n;
		if (t.subtreeFlags & (i ? 10262 : 10256)) for (t = t.child; t !== null;) Bu(e, t, n, r), t = t.sibling;
		else i && eu(t);
	}
	function Bu(e, t, n, r) {
		var i = (n & 335544064) === n;
		i && t.alternate === null && t.return !== null && t.return.alternate !== null && $l(t);
		var a = t.flags;
		switch (t.tag) {
			case 0:
			case 11:
			case 15:
				zu(e, t, n, r), a & 2048 && bl(9, t);
				break;
			case 1:
				zu(e, t, n, r);
				break;
			case 3:
				zu(e, t, n, r), i && du && (e = e.containerInfo, e = e.nodeType === 9 ? e.body : e.nodeName === "HTML" ? e.ownerDocument.body : e, e.style.viewTransitionName === "root" && (e.style.viewTransitionName = ""), e = e.ownerDocument.documentElement, e !== null && e.style.viewTransitionName === "none" && (e.style.viewTransitionName = "")), a & 2048 && (a = null, t.alternate !== null && (a = t.alternate.memoizedState.cache), t = t.memoizedState.cache, t !== a && (t.refCount++, a != null && Aa(a)));
				break;
			case 12:
				if (a & 2048) {
					zu(e, t, n, r), a = t.stateNode;
					try {
						var o = t.memoizedProps, s = o.id, c = o.onPostCommit;
						typeof c == "function" && c(s, t.alternate === null ? "mount" : "update", a.passiveEffectDuration, -0);
					} catch (e) {
						Z(t, t.return, e);
					}
				} else zu(e, t, n, r);
				break;
			case 31:
				zu(e, t, n, r);
				break;
			case 13:
				zu(e, t, n, r);
				break;
			case 23: break;
			case 22:
				o = t.stateNode, s = t.alternate, t.memoizedState === null ? (i && s !== null && s.memoizedState !== null && $l(t), o._visibility & 2 ? zu(e, t, n, r) : (o._visibility |= 2, Vu(e, t, n, r, !!(t.subtreeFlags & 10256) || !1))) : (i && s !== null && s.memoizedState === null && $l(s), o._visibility & 2 ? zu(e, t, n, r) : Hu(e, t)), a & 2048 && Lu(s, t);
				break;
			case 24:
				zu(e, t, n, r), a & 2048 && Ru(t.alternate, t);
				break;
			case 30:
				i && (a = t.alternate, a !== null && (Kl(a.child, !0), Kl(t.child, !0))), zu(e, t, n, r);
				break;
			default: zu(e, t, n, r);
		}
	}
	function Vu(e, t, n, r, i) {
		for (i &&= !!(t.subtreeFlags & 10256) || !1, t = t.child; t !== null;) {
			var a = e, o = t, s = n, c = r, l = o.flags;
			switch (o.tag) {
				case 0:
				case 11:
				case 15:
					Vu(a, o, s, c, i), bl(8, o);
					break;
				case 23: break;
				case 22:
					var u = o.stateNode;
					o.memoizedState === null ? (u._visibility |= 2, Vu(a, o, s, c, i)) : u._visibility & 2 ? Vu(a, o, s, c, i) : Hu(a, o), i && l & 2048 && Lu(o.alternate, o);
					break;
				case 24:
					Vu(a, o, s, c, i), i && l & 2048 && Ru(o.alternate, o);
					break;
				default: Vu(a, o, s, c, i);
			}
			t = t.sibling;
		}
	}
	function Hu(e, t) {
		if (t.subtreeFlags & 10256) for (t = t.child; t !== null;) {
			var n = e, r = t, i = r.flags;
			switch (r.tag) {
				case 22:
					Hu(n, r), i & 2048 && Lu(r.alternate, r);
					break;
				case 24:
					Hu(n, r), i & 2048 && Ru(r.alternate, r);
					break;
				default: Hu(n, r);
			}
			t = t.sibling;
		}
	}
	var Uu = 8192;
	function Wu(e, t, n) {
		if (e.subtreeFlags & Uu) for (e = e.child; e !== null;) Gu(e, t, n), e = e.sibling;
	}
	function Gu(e, t, n) {
		switch (e.tag) {
			case 26:
				Wu(e, t, n), e.flags & Uu && (e.memoizedState === null ? (e = e.stateNode, (t & 335544128) === t && Zm(n, e)) : Qm(n, Ou, e.memoizedState, e.memoizedProps));
				break;
			case 5:
				Wu(e, t, n), e.flags & Uu && (e = e.stateNode, (t & 335544128) === t && Zm(n, e));
				break;
			case 3:
			case 4:
				var r = Ou;
				Ou = bm(e.stateNode.containerInfo), Wu(e, t, n), Ou = r;
				break;
			case 22:
				e.memoizedState === null && (r = e.alternate, r !== null && r.memoizedState !== null ? (r = Uu, Uu = 16777216, Wu(e, t, n), Uu = r) : Wu(e, t, n));
				break;
			case 30:
				if ((e.flags & Uu) !== 0 && (r = e.memoizedProps.name, r != null && r !== "auto")) {
					var i = e.stateNode;
					i.paired = null, zl === null && (zl = /* @__PURE__ */ new Map()), zl.set(r, i);
				}
				Wu(e, t, n);
				break;
			default: Wu(e, t, n);
		}
	}
	function Ku(e) {
		var t = e.alternate;
		if (t !== null && (e = t.child, e !== null)) {
			t.child = null;
			do
				t = e.sibling, e.sibling = null, e = t;
			while (e !== null);
		}
	}
	function qu(e) {
		var t = e.deletions;
		if (e.flags & 16) {
			if (t !== null) for (var n = 0; n < t.length; n++) {
				var r = t[n];
				su = r, Xu(r, e);
			}
			Ku(e);
		}
		if (e.subtreeFlags & 10256) for (e = e.child; e !== null;) Ju(e), e = e.sibling;
	}
	function Ju(e) {
		switch (e.tag) {
			case 0:
			case 11:
			case 15:
				qu(e), e.flags & 2048 && xl(9, e, e.return);
				break;
			case 3:
				qu(e);
				break;
			case 12:
				qu(e);
				break;
			case 22:
				var t = e.stateNode;
				e.memoizedState !== null && t._visibility & 2 && (e.return === null || e.return.tag !== 13) ? (t._visibility &= -3, Yu(e)) : qu(e);
				break;
			default: qu(e);
		}
	}
	function Yu(e) {
		var t = e.deletions;
		if (e.flags & 16) {
			if (t !== null) for (var n = 0; n < t.length; n++) {
				var r = t[n];
				su = r, Xu(r, e);
			}
			Ku(e);
		}
		for (e = e.child; e !== null;) {
			switch (t = e, t.tag) {
				case 0:
				case 11:
				case 15:
					xl(8, t, t.return), Yu(t);
					break;
				case 22:
					n = t.stateNode, n._visibility & 2 && (n._visibility &= -3, Yu(t));
					break;
				default: Yu(t);
			}
			e = e.sibling;
		}
	}
	function Xu(e, t) {
		for (; su !== null;) {
			var n = su;
			switch (n.tag) {
				case 0:
				case 11:
				case 15:
					xl(8, n, t);
					break;
				case 23:
				case 22:
					if (n.memoizedState !== null && n.memoizedState.cachePool !== null) {
						var r = n.memoizedState.cachePool.pool;
						r != null && r.refCount++;
					}
					break;
				case 24: Aa(n.memoizedState.cache);
			}
			if (r = n.child, r !== null) r.return = n, su = r;
			else a: for (n = e; su !== null;) {
				r = su;
				var i = r.sibling, a = r.return;
				if (vu(r), r === n) {
					su = null;
					break a;
				}
				if (i !== null) {
					i.return = a, su = i;
					break a;
				}
				su = a;
			}
		}
	}
	var Zu = {
		getCacheForType: function(e) {
			var t = Sa(Oa), n = t.data.get(e);
			return n === void 0 && (n = e(), t.data.set(e, n)), n;
		},
		cacheSignal: function() {
			return Sa(Oa).controller.signal;
		}
	}, Qu = typeof WeakMap == "function" ? WeakMap : Map, q = 0, $u = null, J = null, Y = 0, X = 0, ed = null, td = !1, nd = !1, rd = !1, id = 0, ad = 0, od = 0, sd = 0, cd = 0, ld = 0, ud = 0, dd = null, fd = null, pd = !1, md = 0, hd = 0, gd = Infinity, _d = null, vd = null, yd = 0, bd = null, xd = null, Sd = 0, Cd = 0, wd = null, Td = null, Ed = null, Dd = null, Od = null, kd = 0, Ad = null;
	function jd() {
		return q & 2 && Y !== 0 ? Y & -Y : E.T === null ? Ct() : Pf();
	}
	function Md() {
		if (ld === 0) {
			if (!(Y & 536870912) || U) {
				var e = st;
				st <<= 1, !(st & 3932160) && (st = 262144), ld = e;
			} else ld = 536870912;
		}
		return e = Oo.current, e !== null && (e.flags |= 32), ld;
	}
	function Nd(e, t) {
		if (t != null) {
			var n = e.stateNode, r = n.ref;
			r === null && (r = n.ref = Pp(hi(e.memoizedProps, n))), Dd === null && (Dd = []), Dd.push(t.bind(null, r));
		}
	}
	function Pd(e, t, n) {
		(e === $u && (X === 2 || X === 9) || e.cancelPendingCommit !== null) && (Vd(e, 0), Rd(e, Y, ld, !1)), gt(e, n), q & 2 && e === $u || (e === $u && (!(q & 2) && (sd |= n), ad === 4 && Rd(e, Y, ld, !1)), Ef(e));
	}
	function Fd(e, t, n) {
		if (q & 6) throw Error(i(327));
		var r = !n && !(t & 127) && (t & e.expiredLanes) === 0 || dt(e, t), a = r ? Yd(e, t) : qd(e, t, !0), o = r;
		do {
			if (a === 0) {
				nd && !r && Rd(e, t, 0, !1);
				break;
			}
			if (n = e.current.alternate, o && !Ld(n)) a = qd(e, t, !1), o = !1;
			else {
				if (a === 2) {
					if (o = t, e.errorRecoveryDisabledLanes & o) var s = 0;
					else s = e.pendingLanes & -536870913, s = s === 0 ? s & 536870912 ? 536870912 : 0 : s;
					if (s !== 0) {
						t = s;
						a: {
							var c = e;
							a = dd;
							var l = c.current.memoizedState.isDehydrated;
							if (l && (Vd(c, s).flags |= 256), s = qd(c, s, !1), s !== 2 && s !== 6) {
								if (rd && !l) {
									c.errorRecoveryDisabledLanes |= o, sd |= o, a = 4;
									break a;
								}
								o = fd, fd = a, o !== null && (fd === null ? fd = o : fd.push.apply(fd, o));
							}
							a = s;
						}
						if (o = !1, a !== 2) continue;
					}
				}
				if (a === 1) {
					Vd(e, 0), Rd(e, t, 0, !0);
					break;
				}
				a: {
					switch (r = e, o = a, o) {
						case 0:
						case 1: throw Error(i(345));
						case 4: if ((t & 4194048) !== t && (t & 62914560) !== t) break;
						case 6:
							Rd(r, t, ld, !td);
							break a;
						case 2:
							fd = null;
							break;
						case 3:
						case 5: break;
						default: throw Error(i(329));
					}
					if ((t & 62914560) === t && (a = md + 300 - N(), 10 < a)) {
						if (Rd(r, t, ld, !td), ut(r, 0, !0) !== 0) break a;
						Sd = t, r.timeoutHandle = gp(Id.bind(null, r, n, fd, _d, pd, t, ld, sd, ud, td, o, "Throttled", -0, 0), a);
						break a;
					}
					Id(r, n, fd, _d, pd, t, ld, sd, ud, td, o, null, -0, 0);
				}
				break;
			}
		} while (1);
		Ef(e);
	}
	function Id(e, t, n, r, i, a, o, s, c, l, u, d, f, p) {
		e.timeoutHandle = -1;
		var m = t.subtreeFlags, h = (a & 335544064) === a;
		d = null, (h || m & 8192 || (m & 16785408) == 16785408) && (d = {
			stylesheets: null,
			count: 0,
			imgCount: 0,
			imgBytes: 0,
			suspenseyImages: [],
			waitingForImages: !0,
			waitingForViewTransition: !1,
			unsuspend: R
		}, zl = null, Gu(t, a, d), h && (m = d, h = e.containerInfo, h = (h.nodeType === 9 ? h : h.ownerDocument).__reactViewTransition, h != null && (m.count++, m.waitingForViewTransition = !0, m = nh.bind(m), h.finished.then(m, m))), m = (a & 62914560) === a ? md - N() : (a & 4194048) === a ? hd - N() : 0, m = eh(d, m), m !== null) ? (Sd = a, e.cancelPendingCommit = m(nf.bind(null, e, t, a, n, r, i, o, s, c, l, u, d, null, f, p)), Rd(e, a, o, !l)) : nf(e, t, a, n, r, i, o, s, c, l, u, d);
	}
	function Ld(e) {
		for (var t = e;;) {
			var n = t.tag;
			if ((n === 0 || n === 11 || n === 15) && t.flags & 16384 && (n = t.updateQueue, n !== null && (n = n.stores, n !== null))) for (var r = 0; r < n.length; r++) {
				var i = n[r], a = i.getSnapshot;
				i = i.value;
				try {
					if (!zr(a(), i)) return !1;
				} catch {
					return !1;
				}
			}
			if (n = t.child, t.subtreeFlags & 16384 && n !== null) n.return = t, t = n;
			else {
				if (t === e) break;
				for (; t.sibling === null;) {
					if (t.return === null || t.return === e) return !0;
					t = t.return;
				}
				t.sibling.return = t.return, t = t.sibling;
			}
		}
		return !0;
	}
	function Rd(e, t, n, r) {
		t = ft(e, t), t &= ~cd, t &= ~sd, e.suspendedLanes |= t, e.pingedLanes &= ~t, r && (e.warmLanes |= t), r = e.expirationTimes;
		for (var i = t; 0 < i;) {
			var a = 31 - nt(i), o = 1 << a;
			r[a] = -1, i &= ~o;
		}
		n !== 0 && vt(e, n, t);
	}
	function zd() {
		return q & 6 ? !0 : (Df(0, !1), !1);
	}
	function Bd() {
		if (J !== null) {
			if (X === 0) var e = J.return;
			else e = J, ma = pa = null, ns(e), no = null, ro = 0, e = J;
			for (; e !== null;) yl(e.alternate, e), e = e.return;
			J = null;
		}
	}
	function Vd(e, t) {
		var n = e.timeoutHandle;
		return n !== -1 && (e.timeoutHandle = -1, _p(n)), n = e.cancelPendingCommit, n !== null && (e.cancelPendingCommit = null, n()), Sd = 0, Bd(), $u = e, J = n = Mi(e.current, null), Y = t, X = 0, ed = null, td = !1, nd = dt(e, t), rd = !1, ud = ld = cd = sd = od = ad = 0, fd = dd = null, pd = !1, id = ft(e, t), Si(), n;
	}
	function Hd(e, t) {
		W = null, E.H = fc, t === Ka || t === Ja ? (t = eo(), X = 3) : t === qa ? (t = eo(), X = 4) : X = t === Ac ? 8 : typeof t == "object" && t && typeof t.then == "function" ? 6 : 1, ed = t, J === null && (ad = 1, wc(e, Bi(t, e.current)));
	}
	function Ud() {
		var e = Oo.current;
		return e === null ? !0 : (Y & 4194048) === Y ? ko === null : (Y & 62914560) === Y || Y & 536870912 ? e === ko : !1;
	}
	function Wd() {
		var e = E.H;
		return E.H = fc, e === null ? fc : e;
	}
	function Gd() {
		var e = E.A;
		return E.A = Zu, e;
	}
	function Kd() {
		ad = 4, td || (Y & 4194048) !== Y && Oo.current !== null || (nd = !0), !(od & 134217727) && !(sd & 134217727) || $u === null || Rd($u, Y, ld, !1);
	}
	function qd(e, t, n) {
		var r = q;
		q |= 2;
		var i = Wd(), a = Gd();
		($u !== e || Y !== t) && (_d = null, Vd(e, t)), t = !1;
		var o = ad;
		a: do
			try {
				if (X !== 0 && J !== null) {
					var s = J, c = ed;
					switch (X) {
						case 8:
							Bd(), o = 6;
							break a;
						case 3:
						case 2:
						case 9:
						case 6:
							Oo.current === null && (t = !0);
							var l = X;
							if (X = 0, ed = null, $d(e, s, c, l), n && nd) {
								o = 0;
								break a;
							}
							break;
						default: l = X, X = 0, ed = null, $d(e, s, c, l);
					}
				}
				Jd(), o = ad;
				break;
			} catch (t) {
				Hd(e, t);
			}
		while (1);
		return t && e.shellSuspendCounter++, ma = pa = null, q = r, E.H = i, E.A = a, J === null && ($u = null, Y = 0, Si()), o;
	}
	function Jd() {
		for (; J !== null;) Zd(J);
	}
	function Yd(e, t) {
		var n = q;
		q |= 2;
		var r = Wd(), a = Gd();
		$u !== e || Y !== t ? (_d = null, gd = N() + 500, Vd(e, t)) : nd = dt(e, t);
		a: do
			try {
				if (X !== 0 && J !== null) {
					t = J;
					var o = ed;
					b: switch (X) {
						case 1:
							X = 0, ed = null, $d(e, t, o, 1);
							break;
						case 2:
						case 9:
							if (Xa(o)) {
								X = 0, ed = null, Qd(t);
								break;
							}
							t = function() {
								X !== 2 && X !== 9 || $u !== e || (X = 7), Ef(e);
							}, o.then(t, t);
							break a;
						case 3:
							X = 7;
							break a;
						case 4:
							X = 5;
							break a;
						case 7:
							Xa(o) ? (X = 0, ed = null, Qd(t)) : (X = 0, ed = null, $d(e, t, o, 7));
							break;
						case 5:
							var s = null;
							switch (J.tag) {
								case 26: s = J.memoizedState;
								case 5:
								case 27:
									var c = J;
									if (s ? Ym(s) : c.stateNode.complete) {
										X = 0, ed = null;
										var l = c.sibling;
										if (l !== null) J = l;
										else {
											var u = c.return;
											u === null ? J = null : (J = u, ef(u));
										}
										break b;
									}
							}
							X = 0, ed = null, $d(e, t, o, 5);
							break;
						case 6:
							X = 0, ed = null, $d(e, t, o, 6);
							break;
						case 8:
							Bd(), ad = 6;
							break a;
						default: throw Error(i(462));
					}
				}
				Xd();
				break;
			} catch (t) {
				Hd(e, t);
			}
		while (1);
		return ma = pa = null, E.H = r, E.A = a, q = n, J === null ? ($u = null, Y = 0, Si(), ad) : 0;
	}
	function Xd() {
		for (; J !== null && !M();) Zd(J);
	}
	function Zd(e) {
		var t = ul(e.alternate, e, id);
		e.memoizedProps = e.pendingProps, t === null ? ef(e) : J = t;
	}
	function Qd(e) {
		var t = e, n = t.alternate;
		switch (t.tag) {
			case 15:
			case 0:
				t = Wc(n, t, t.pendingProps, t.type, void 0, Y);
				break;
			case 11:
				t = Wc(n, t, t.pendingProps, t.type.render, t.ref, Y);
				break;
			case 5:
				ns(t);
				var r = t;
				r === ta && (U ? (sa(r), r.tag === 5 && r.stateNode != null && (H = r.stateNode)) : (sa(r), U = !0));
			default: yl(n, t), t = J = Ni(t, id), t = ul(n, t, id);
		}
		e.memoizedProps = e.pendingProps, t === null ? ef(e) : J = t;
	}
	function $d(e, t, n, r) {
		ma = pa = null, ns(t), no = null, ro = 0;
		var i = t.return;
		try {
			if (kc(e, i, t, n, Y)) {
				ad = 1, wc(e, Bi(n, e.current)), J = null;
				return;
			}
		} catch (t) {
			if (i !== null) throw J = i, t;
			ad = 1, wc(e, Bi(n, e.current)), J = null;
			return;
		}
		t.flags & 32768 ? (U || r === 1 ? e = !0 : nd || Y & 536870912 ? e = !1 : (td = e = !0, (r === 2 || r === 9 || r === 3 || r === 6) && (r = Oo.current, r !== null && r.tag === 13 && (r.flags |= 16384))), tf(t, e)) : ef(t);
	}
	function ef(e) {
		var t = e;
		do {
			if (t.flags & 32768) {
				tf(t, td);
				return;
			}
			e = t.return;
			var n = _l(t.alternate, t, id);
			if (n !== null) {
				J = n;
				return;
			}
			if (t = t.sibling, t !== null) {
				J = t;
				return;
			}
			J = t = e;
		} while (t !== null);
		ad === 0 && (ad = 5);
	}
	function tf(e, t) {
		do {
			var n = vl(e.alternate, e);
			if (n !== null) {
				n.flags &= 32767, J = n;
				return;
			}
			if (n = e.return, n !== null && (n.flags |= 32768, n.subtreeFlags = 0, n.deletions = null), !t && (e = e.sibling, e !== null)) {
				J = e;
				return;
			}
			J = e = n;
		} while (e !== null);
		ad = 6, J = null;
	}
	function nf(e, t, n, r, a, o, s, c, l, u, d, f) {
		e.cancelPendingCommit = null;
		do
			df();
		while (yd !== 0);
		if (q & 6) throw Error(i(327));
		if (t !== null) {
			if (t === e.current) throw Error(i(177));
			e === $u && (J = $u = null, Y = 0), xd = t, bd = e, Sd = n, wd = a, Td = r, rf(e, t, n, s, c, l, f);
		}
	}
	function rf(e, t, n, r, i, a, o) {
		var s = t.lanes | t.childLanes;
		if (Cd = s, s |= xi, _t(e, n, s, r, i, a), Dd = null, (n & 335544064) === n ? (Od = Na(e), r = 10262) : (Od = null, r = 10256), (t.subtreeFlags & r) !== 0 || (t.flags & r) !== 0 ? (e.callbackNode = null, e.callbackPriority = 0, yf(Ye, function() {
			return ff(), null;
		})) : (e.callbackNode = null, e.callbackPriority = 0), Rl = !1, r = !!(t.flags & 13878), t.subtreeFlags & 13878 || r) {
			r = E.T, E.T = null, i = D.p, D.p = 2, a = q, q |= 4;
			try {
				fu(e, t, n);
			} finally {
				q = a, D.p = i, E.T = r;
			}
		}
		yd = 1, Rl ? Ed = Mp(o, e.containerInfo, Od, sf, cf, of, lf, ff, af, null, null) : (sf(), cf(), lf());
	}
	function af(e) {
		if (yd !== 0) {
			var t = bd.onRecoverableError;
			t(e, { componentStack: null });
		}
	}
	function of() {
		yd === 3 && (yd = 0, Nu(xd, bd), yd = 4);
	}
	function sf() {
		if (yd === 1) {
			yd = 0;
			var e = bd, t = xd, n = Sd, r = !!(t.flags & 13878);
			if (t.subtreeFlags & 13878 || r) {
				r = E.T, E.T = null;
				var i = D.p;
				D.p = 2;
				var a = q;
				q |= 4;
				try {
					lu = uu = !1, ku(t, e, n), n = cp;
					var o = Gr(e.containerInfo), s = n.focusedElem, c = n.selectionRange;
					if (o !== s && s && s.ownerDocument && Wr(s.ownerDocument.documentElement, s)) {
						if (c !== null && Kr(s)) {
							var l = c.start, u = c.end;
							if (u === void 0 && (u = l), "selectionStart" in s) s.selectionStart = l, s.selectionEnd = Math.min(u, s.value.length);
							else {
								var d = s.ownerDocument || document, f = d && d.defaultView || window;
								if (f.getSelection) {
									var p = f.getSelection(), m = s.textContent.length, h = Math.min(c.start, m), g = c.end === void 0 ? h : Math.min(c.end, m);
									!p.extend && h > g && (o = g, g = h, h = o);
									var _ = Ur(s, h), v = Ur(s, g);
									if (_ && v && (p.rangeCount !== 1 || p.anchorNode !== _.node || p.anchorOffset !== _.offset || p.focusNode !== v.node || p.focusOffset !== v.offset)) {
										var y = d.createRange();
										y.setStart(_.node, _.offset), p.removeAllRanges(), h > g ? (p.addRange(y), p.extend(v.node, v.offset)) : (y.setEnd(v.node, v.offset), p.addRange(y));
									}
								}
							}
						}
						for (d = [], p = s; p = p.parentNode;) p.nodeType === 1 && d.push({
							element: p,
							left: p.scrollLeft,
							top: p.scrollTop
						});
						for (typeof s.focus == "function" && s.focus(), s = 0; s < d.length; s++) {
							var b = d[s];
							b.element.scrollLeft = b.left, b.element.scrollTop = b.top;
						}
					}
					gh = !!sp, cp = sp = null;
				} finally {
					q = a, D.p = i, E.T = r;
				}
			}
			e.current = t, yd = 2;
		}
	}
	function cf() {
		if (yd === 2) {
			yd = 0;
			var e = bd, t = xd, n = !!(t.flags & 8772);
			if (t.subtreeFlags & 8772 || n) {
				n = E.T, E.T = null;
				var r = D.p;
				D.p = 2;
				var i = q;
				q |= 4;
				try {
					mu(e, t.alternate, t);
				} finally {
					q = i, D.p = r, E.T = n;
				}
			}
			yd = 3;
		}
	}
	function lf() {
		if (yd === 4 || yd === 3) {
			yd = 0;
			var e = Ed;
			Ed = null, Ge();
			var t = bd, n = xd, r = Sd, i = Td, a = (r & 335544064) === r ? 10262 : 10256;
			if ((n.subtreeFlags & a) !== 0 || (n.flags & a) !== 0 ? yd = 5 : (yd = 0, xd = bd = null, uf(t, t.pendingLanes)), a = t.pendingLanes, a === 0 && (vd = null), St(r), n = n.stateNode, P && typeof P.onCommitFiberRoot == "function") try {
				P.onCommitFiberRoot(et, n, void 0, (n.current.flags & 128) == 128);
			} catch {}
			if (i !== null) {
				n = E.T, a = D.p, D.p = 2, E.T = null;
				try {
					for (var o = t.onRecoverableError, s = 0; s < i.length; s++) {
						var c = i[s];
						o(c.value, { componentStack: c.stack });
					}
				} finally {
					E.T = n, D.p = a;
				}
			}
			if (i = Dd, o = Od, Od = null, i !== null && (Dd = null, o === null && (o = []), e !== null)) for (c = 0; c < i.length; c++) n = (0, i[c])(o), n !== void 0 && e.finished.finally(n);
			Sd & 3 && df(), Ef(t), a = t.pendingLanes, r & 261930 && a & 42 ? t === Ad ? kd++ : (kd = 0, Ad = t) : (kd = 0, Ad = null), Df(0, !1);
		}
	}
	function uf(e, t) {
		(e.pooledCacheLanes &= t) === 0 && (t = e.pooledCache, t != null && (e.pooledCache = null, Aa(t)));
	}
	function df() {
		return Ed !== null && (Ed.skipTransition(), Ed = null), sf(), cf(), lf(), ff();
	}
	function ff() {
		if (yd !== 5) return !1;
		var e = bd, t = Cd;
		Cd = 0;
		var n = St(Sd), r = E.T, a = D.p;
		try {
			D.p = 32 > n ? 32 : n, E.T = null, n = wd, wd = null;
			var o = bd, s = Sd;
			if (yd = 0, xd = bd = null, Sd = 0, q & 6) throw Error(i(331));
			var c = q;
			if (q |= 4, Ju(o.current), Bu(o, o.current, s, n), q = c, Df(0, !1), P && typeof P.onPostCommitFiberRoot == "function") try {
				P.onPostCommitFiberRoot(et, o);
			} catch {}
			return !0;
		} finally {
			D.p = a, E.T = r, uf(e, t);
		}
	}
	function pf(e, t, n) {
		t = Bi(n, t), t = Ec(e.stateNode, t, 2), e = ho(e, t, 2), e !== null && (gt(e, 2), Ef(e));
	}
	function Z(e, t, n) {
		if (e.tag === 3) pf(e, e, n);
		else for (; t !== null;) {
			if (t.tag === 3) {
				pf(t, e, n);
				break;
			}
			if (t.tag === 1) {
				var r = t.stateNode;
				if (typeof t.type.getDerivedStateFromError == "function" || typeof r.componentDidCatch == "function" && (vd === null || !vd.has(r))) {
					e = Bi(n, e), n = Dc(2), r = ho(t, n, 2), r !== null && (Oc(n, r, t, e), gt(r, 2), Ef(r));
					break;
				}
			}
			t = t.return;
		}
	}
	function mf(e, t, n) {
		var r = e.pingCache;
		if (r === null) {
			r = e.pingCache = new Qu();
			var i = /* @__PURE__ */ new Set();
			r.set(t, i);
		} else i = r.get(t), i === void 0 && (i = /* @__PURE__ */ new Set(), r.set(t, i));
		i.has(n) || (rd = !0, i.add(n), e = hf.bind(null, e, t, n), t.then(e, e));
	}
	function hf(e, t, n) {
		var r = e.pingCache;
		r !== null && r.delete(t), e.pingedLanes |= e.suspendedLanes & n, e.warmLanes &= ~n, $u === e && (Y & n) === n && (ad === 4 || ad === 3 && (Y & 62914560) === Y && 300 > N() - md ? q & 2 ? cd |= n : Vd(e, 0) : cd |= n, ud === Y && (ud = 0)), Ef(e);
	}
	function gf(e, t) {
		t === 0 && (t = mt()), e = Ti(e, t), e !== null && (gt(e, t), Ef(e));
	}
	function _f(e) {
		var t = e.memoizedState, n = 0;
		t !== null && (n = t.retryLane), gf(e, n);
	}
	function vf(e, t) {
		var n = 0;
		switch (e.tag) {
			case 31:
			case 13:
				var r = e.stateNode, a = e.memoizedState;
				a !== null && (n = a.retryLane);
				break;
			case 19:
				r = e.stateNode;
				break;
			case 22:
				r = e.stateNode._retryCache;
				break;
			default: throw Error(i(314));
		}
		r !== null && r.delete(t), gf(e, n);
	}
	function yf(e, t) {
		return Ue(e, t);
	}
	var bf = null, xf = null, Sf = !1, Cf = !1, wf = !1, Tf = 0;
	function Ef(e) {
		e !== xf && e.next === null && (xf === null ? bf = xf = e : xf = xf.next = e), Cf = !0, Sf || (Sf = !0, Nf());
	}
	function Df(e, t) {
		if (!wf && Cf) {
			wf = !0;
			do
				for (var n = !1, r = bf; r !== null;) {
					if (!t) {
						if (e !== 0) {
							var i = r.pendingLanes;
							if (i === 0) var a = 0;
							else {
								var o = r.suspendedLanes, s = r.pingedLanes;
								a = (1 << 31 - nt(42 | e) + 1) - 1, a &= i & ~(o & ~s), a = a & 201326741 ? a & 201326741 | 1 : a ? a | 2 : 0;
							}
							a !== 0 && (n = !0, Mf(r, a));
						} else a = Y, a = ut(r, r === $u ? a : 0, r.cancelPendingCommit !== null || r.timeoutHandle !== -1), !(a & 3) || dt(r, a) || (n = !0, Mf(r, a));
					}
					r = r.next;
				}
			while (n);
			wf = !1;
		}
	}
	function Of() {
		kf();
	}
	function kf() {
		Cf = Sf = !1;
		var e = 0;
		Tf !== 0 && hp() && (e = Tf);
		for (var t = N(), n = null, r = bf; r !== null;) {
			var i = r.next, a = Af(r, t);
			a === 0 ? (r.next = null, n === null ? bf = i : n.next = i, i === null && (xf = n)) : (n = r, (e !== 0 || a & 3) && (Cf = !0)), r = i;
		}
		yd !== 0 && yd !== 5 || Df(e, !1), Tf !== 0 && (Tf = 0);
	}
	function Af(e, t) {
		for (var n = e.suspendedLanes, r = e.pingedLanes, i = e.expirationTimes, a = e.pendingLanes & -62914561; 0 < a;) {
			var o = 31 - nt(a), s = 1 << o, c = i[o];
			c === -1 ? ((s & n) === 0 || (s & r) !== 0) && (i[o] = pt(s, t)) : c <= t && (e.expiredLanes |= s), a &= ~s;
		}
		if (t = $u, n = Y, n = ut(e, e === t ? n : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), r = e.callbackNode, n === 0 || e === t && (X === 2 || X === 9) || e.cancelPendingCommit !== null) return r !== null && r !== null && We(r), e.callbackNode = null, e.callbackPriority = 0;
		if (!(n & 3) || dt(e, n)) {
			if (t = n & -n, t === e.callbackPriority) return t;
			switch (r !== null && We(r), St(n)) {
				case 2:
				case 8:
					n = Je;
					break;
				case 32:
					n = Ye;
					break;
				case 268435456:
					n = Ze;
					break;
				default: n = Ye;
			}
			return r = jf.bind(null, e), n = Ue(n, r), e.callbackPriority = t, e.callbackNode = n, t;
		}
		return r !== null && r !== null && We(r), e.callbackPriority = 2, e.callbackNode = null, 2;
	}
	function jf(e, t) {
		if (yd !== 0 && yd !== 5) return e.callbackNode = null, e.callbackPriority = 0, null;
		var n = e.callbackNode;
		if (df() && e.callbackNode !== n) return null;
		var r = Y;
		return r = ut(e, e === $u ? r : 0, e.cancelPendingCommit !== null || e.timeoutHandle !== -1), r === 0 ? null : (Fd(e, r, t), Af(e, N()), e.callbackNode != null && e.callbackNode === n ? jf.bind(null, e) : null);
	}
	function Mf(e, t) {
		if (df()) return null;
		Fd(e, t, !0);
	}
	function Nf() {
		bp(function() {
			q & 6 ? Ue(qe, Of) : kf();
		});
	}
	function Pf() {
		if (Tf === 0) {
			var e = Ia;
			e === 0 && (e = ot, ot <<= 1, !(ot & 261888) && (ot = 256)), Tf = e;
		}
		return Tf;
	}
	function Ff(e) {
		return e == null || typeof e == "symbol" || typeof e == "boolean" ? null : typeof e == "function" ? e : L(e);
	}
	function If(e, t, n, r, i) {
		if (t === "submit" && n && n.stateNode === i) {
			var a = Ff((i[Dt] || null).action), o = r.submitter;
			o && (t = (t = o[Dt] || null) ? Ff(t.formAction) : o.getAttribute("formAction"), t !== null && (a = t, o = null));
			var s = new Rn("action", "action", null, r, i);
			e.push({
				event: s,
				listeners: [{
					instance: null,
					listener: function() {
						if (r.defaultPrevented) {
							if (Tf !== 0) {
								var e = new FormData(i, o);
								Qs(n, {
									pending: !0,
									data: e,
									method: i.method,
									action: a
								}, null, e);
							}
						} else typeof a == "function" && (s.preventDefault(), e = new FormData(i, o), Qs(n, {
							pending: !0,
							data: e,
							method: i.method,
							action: a
						}, a, e));
					},
					currentTarget: i
				}]
			});
		}
	}
	for (var Lf = 0; Lf < fi.length; Lf++) {
		var Rf = fi[Lf];
		pi(Rf.toLowerCase(), "on" + (Rf[0].toUpperCase() + Rf.slice(1)));
	}
	pi(ii, "onAnimationEnd"), pi(ai, "onAnimationIteration"), pi(oi, "onAnimationStart"), pi("dblclick", "onDoubleClick"), pi("focusin", "onFocus"), pi("focusout", "onBlur"), pi(si, "onTransitionRun"), pi(ci, "onTransitionStart"), pi(li, "onTransitionCancel"), pi(ui, "onTransitionEnd"), Gt("onMouseEnter", ["mouseout", "mouseover"]), Gt("onMouseLeave", ["mouseout", "mouseover"]), Gt("onPointerEnter", ["pointerout", "pointerover"]), Gt("onPointerLeave", ["pointerout", "pointerover"]), Wt("onChange", "change click focusin focusout input keydown keyup selectionchange".split(" ")), Wt("onSelect", "focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" ")), Wt("onBeforeInput", [
		"compositionend",
		"keypress",
		"textInput",
		"paste"
	]), Wt("onCompositionEnd", "compositionend focusout keydown keypress keyup mousedown".split(" ")), Wt("onCompositionStart", "compositionstart focusout keydown keypress keyup mousedown".split(" ")), Wt("onCompositionUpdate", "compositionupdate focusout keydown keypress keyup mousedown".split(" "));
	var zf = "abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "), Bf = new Set("beforetoggle cancel close invalid load scroll scrollend toggle".split(" ").concat(zf));
	function Vf(e, t) {
		t = !!(t & 4);
		for (var n = 0; n < e.length; n++) {
			var r = e[n], i = r.event;
			r = r.listeners;
			a: {
				var a = void 0;
				if (t) for (var o = r.length - 1; 0 <= o; o--) {
					var s = r[o], c = s.instance, l = s.currentTarget;
					if (s = s.listener, c !== a && i.isPropagationStopped()) break a;
					a = s, i.currentTarget = l;
					try {
						a(i);
					} catch (e) {
						vi(e);
					}
					i.currentTarget = null, a = c;
				}
				else for (o = 0; o < r.length; o++) {
					if (s = r[o], c = s.instance, l = s.currentTarget, s = s.listener, c !== a && i.isPropagationStopped()) break a;
					a = s, i.currentTarget = l;
					try {
						a(i);
					} catch (e) {
						vi(e);
					}
					i.currentTarget = null, a = c;
				}
			}
		}
	}
	function Q(e, t) {
		var n = t[kt];
		n === void 0 && (n = t[kt] = /* @__PURE__ */ new Set());
		var r = e + "__bubble";
		n.has(r) || (Gf(t, e, 2, !1), n.add(r));
	}
	function Hf(e, t, n) {
		var r = 0;
		t && (r |= 4), Gf(n, e, r, t);
	}
	var Uf = "_reactListening" + Math.random().toString(36).slice(2);
	function Wf(e) {
		if (!e[Uf]) {
			e[Uf] = !0, Ht.forEach(function(t) {
				t !== "selectionchange" && (Bf.has(t) || Hf(t, !1, e), Hf(t, !0, e));
			});
			var t = e.nodeType === 9 ? e : e.ownerDocument;
			t === null || t[Uf] || (t[Uf] = !0, Hf("selectionchange", !1, t));
		}
	}
	function Gf(e, t, n, r) {
		switch (Ch(t)) {
			case 2:
				var i = _h;
				break;
			case 8:
				i = vh;
				break;
			default: i = yh;
		}
		n = i.bind(null, t, n, e), i = void 0, !Dn || t !== "touchstart" && t !== "touchmove" && t !== "wheel" || (i = !0), r ? i === void 0 ? e.addEventListener(t, n, !0) : e.addEventListener(t, n, {
			capture: !0,
			passive: i
		}) : i === void 0 ? e.addEventListener(t, n, !1) : e.addEventListener(t, n, { passive: i });
	}
	function Kf(e, t, n, r, i) {
		var a = r;
		if (!(t & 1) && !(t & 2) && r !== null) a: for (;;) {
			if (r === null) return;
			var s = r.tag;
			if (s === 3 || s === 4) {
				var c = r.stateNode.containerInfo;
				if (c === i) break;
				if (s === 4) for (s = r.return; s !== null;) {
					var l = s.tag;
					if ((l === 3 || l === 4) && s.stateNode.containerInfo === i) return;
					s = s.return;
				}
				for (; c !== null;) {
					if (s = It(c), s === null) return;
					if (l = s.tag, l === 5 || l === 6 || l === 26 || l === 27) {
						r = a = s;
						continue a;
					}
					c = c.parentNode;
				}
			}
			r = r.return;
		}
		wn(function() {
			var r = a, i = z(n), s = [];
			a: {
				var c = di.get(e);
				if (c !== void 0) {
					var l = Rn, u = e;
					switch (e) {
						case "keypress": if (Nn(n) === 0) break a;
						case "keydown":
						case "keyup":
							l = tr;
							break;
						case "focusin":
							u = "focus", l = Kn;
							break;
						case "focusout":
							u = "blur", l = Kn;
							break;
						case "beforeblur":
						case "afterblur":
							l = Kn;
							break;
						case "click": if (n.button === 2) break a;
						case "auxclick":
						case "dblclick":
						case "mousedown":
						case "mousemove":
						case "mouseup":
						case "mouseout":
						case "mouseover":
						case "contextmenu":
							l = Gn;
							break;
						case "drag":
						case "dragend":
						case "dragenter":
						case "dragexit":
						case "dragleave":
						case "dragover":
						case "dragstart":
						case "drop":
							l = V;
							break;
						case "touchcancel":
						case "touchend":
						case "touchmove":
						case "touchstart":
							l = ir;
							break;
						case ii:
						case ai:
						case oi:
							l = qn;
							break;
						case ui:
							l = ar;
							break;
						case "scroll":
						case "scrollend":
							l = Bn;
							break;
						case "wheel":
							l = or;
							break;
						case "copy":
						case "cut":
						case "paste":
							l = Jn;
							break;
						case "gotpointercapture":
						case "lostpointercapture":
						case "pointercancel":
						case "pointerdown":
						case "pointermove":
						case "pointerout":
						case "pointerover":
						case "pointerup":
							l = nr;
							break;
						case "submit":
							l = rr;
							break;
						case "toggle":
						case "beforetoggle": l = sr;
					}
					var d = !!(t & 4), f = !d && (e === "scroll" || e === "scrollend"), p = d ? c === null ? null : c + "Capture" : c;
					d = [];
					for (var m = r, h; m !== null;) {
						var g = m;
						if (h = g.stateNode, g = g.tag, g !== 5 && g !== 26 && g !== 27 || h === null || p === null || (g = Tn(m, p), g != null && d.push(qf(m, g, h))), f) break;
						m = m.return;
					}
					0 < d.length && (c = new l(c, u, null, n, i), s.push({
						event: c,
						listeners: d
					}));
				}
			}
			if (!(t & 7)) {
				a: {
					if (l = e === "mouseover" || e === "pointerover", c = e === "mouseout" || e === "pointerout", l && n !== bn && (u = n.relatedTarget || n.fromElement) && (It(u) || u[Ot])) break a;
					(c || l) && (u = i.window === i ? i : (l = i.ownerDocument) ? l.defaultView || l.parentWindow : window, c ? (l = n.relatedTarget || n.toElement, c = r, l = l ? It(l) : null, l !== null && (f = o(l), d = l.tag, l !== f || d !== 5 && d !== 27 && d !== 6) && (l = null)) : (c = null, l = r), c !== l && (d = Gn, g = "onMouseLeave", p = "onMouseEnter", m = "mouse", (e === "pointerout" || e === "pointerover") && (d = nr, g = "onPointerLeave", p = "onPointerEnter", m = "pointer"), f = c == null ? u : Rt(c), h = l == null ? u : Rt(l), u = new d(g, m + "leave", c, n, i), u.target = f, u.relatedTarget = h, g = null, It(i) === r && (d = new d(p, m + "enter", l, n, i), d.target = h, d.relatedTarget = f, g = d), f = g, d = c && l ? te(c, l, Yf) : null, c !== null && Xf(s, u, c, d, !1), l !== null && f !== null && Xf(s, f, l, d, !0)));
				}
				a: {
					if (c = r ? Rt(r) : window, l = c.nodeName && c.nodeName.toLowerCase(), l === "select" || l === "input" && c.type === "file") var _ = Dr;
					else if (xr(c)) {
						if (Or) _ = Lr;
						else {
							_ = Fr;
							var v = Pr;
						}
					} else l = c.nodeName, !l || l.toLowerCase() !== "input" || c.type !== "checkbox" && c.type !== "radio" ? r && _n(r.elementType) && (_ = Dr) : _ = Ir;
					if (_ &&= _(e, r)) {
						Sr(s, _, n, i);
						break a;
					}
					v && v(e, c, r);
				}
				switch (v = r ? Rt(r) : window, e) {
					case "focusin":
						(xr(v) || v.contentEditable === "true") && (Jr = v, Yr = r, Xr = null);
						break;
					case "focusout":
						Xr = Yr = Jr = null;
						break;
					case "mousedown":
						Zr = !0;
						break;
					case "contextmenu":
					case "mouseup":
					case "dragend":
						Zr = !1, Qr(s, n, i);
						break;
					case "selectionchange": if (qr) break;
					case "keydown":
					case "keyup": Qr(s, n, i);
				}
				var y;
				if (lr) b: {
					switch (e) {
						case "compositionstart":
							var b = "onCompositionStart";
							break b;
						case "compositionend":
							b = "onCompositionEnd";
							break b;
						case "compositionupdate":
							b = "onCompositionUpdate";
							break b;
					}
					b = void 0;
				}
				else _r ? hr(e, n) && (b = "onCompositionEnd") : e === "keydown" && n.keyCode === 229 && (b = "onCompositionStart");
				b && (fr && n.locale !== "ko" && (_r || b !== "onCompositionStart" ? b === "onCompositionEnd" && _r && (y = Mn()) : (kn = i, An = "value" in kn ? kn.value : kn.textContent, _r = !0)), v = Jf(r, b), 0 < v.length && (b = new Yn(b, e, null, n, i), s.push({
					event: b,
					listeners: v
				}), y ? b.data = y : (y = gr(n), y !== null && (b.data = y)))), (y = dr ? vr(e, n) : yr(e, n)) && (b = Jf(r, "onBeforeInput"), 0 < b.length && (v = new Yn("onBeforeInput", "beforeinput", null, n, i), s.push({
					event: v,
					listeners: b
				}), v.data = y)), If(s, e, r, n, i);
			}
			Vf(s, t);
		});
	}
	function qf(e, t, n) {
		return {
			instance: e,
			listener: t,
			currentTarget: n
		};
	}
	function Jf(e, t) {
		for (var n = t + "Capture", r = []; e !== null;) {
			var i = e, a = i.stateNode;
			if (i = i.tag, i !== 5 && i !== 26 && i !== 27 || a === null || (i = Tn(e, n), i != null && r.unshift(qf(e, i, a)), i = Tn(e, t), i != null && r.push(qf(e, i, a))), e.tag === 3) return r;
			e = e.return;
		}
		return [];
	}
	function Yf(e) {
		if (e === null) return null;
		do
			e = e.return;
		while (e && e.tag !== 5 && e.tag !== 27);
		return e || null;
	}
	function Xf(e, t, n, r, i) {
		for (var a = t._reactName, o = []; n !== null && n !== r;) {
			var s = n, c = s.alternate, l = s.stateNode;
			if (s = s.tag, c !== null && c === r) break;
			s !== 5 && s !== 26 && s !== 27 || l === null || (c = l, i ? (l = Tn(n, a), l != null && o.unshift(qf(n, l, c))) : i || (l = Tn(n, a), l != null && o.push(qf(n, l, c)))), n = n.return;
		}
		o.length !== 0 && e.push({
			event: t,
			listeners: o
		});
	}
	var Zf = /\r\n?/g, Qf = /\u0000|\uFFFD/g;
	function $f(e) {
		return (typeof e == "string" ? e : "" + e).replace(Zf, "\n").replace(Qf, "");
	}
	function ep(e, t) {
		return t = $f(t), $f(e) === t;
	}
	function $(e, t, n, r, a, o) {
		switch (n) {
			case "children":
				if (typeof r == "string") t === "body" || t === "textarea" && r === "" || mn(e, r);
				else if (typeof r == "number" || typeof r == "bigint") t !== "body" && mn(e, "" + r);
				else return;
				break;
			case "className":
				Qt(e, "class", r);
				break;
			case "tabIndex":
				Qt(e, "tabindex", r);
				break;
			case "dir":
			case "role":
			case "viewBox":
			case "width":
			case "height":
				Qt(e, n, r);
				break;
			case "style":
				I(e, r, o);
				return;
			case "data": if (t !== "object") {
				Qt(e, "data", r);
				break;
			}
			case "src":
			case "href":
				if (r === "" && (t !== "a" || n !== "href") || r == null || typeof r == "function" || typeof r == "symbol" || typeof r == "boolean") {
					e.removeAttribute(n);
					break;
				}
				r = L(r), e.setAttribute(n, r);
				break;
			case "action":
			case "formAction":
				if (typeof r == "function") {
					e.setAttribute(n, "javascript:throw new Error('A React form was unexpectedly submitted. If you called form.submit() manually, consider using form.requestSubmit() instead. If you\\'re trying to use event.stopPropagation() in a submit event handler, consider also calling event.preventDefault().')");
					break;
				}
				if (typeof o == "function" && (n === "formAction" ? (t !== "input" && $(e, t, "name", a.name, a, null), $(e, t, "formEncType", a.formEncType, a, null), $(e, t, "formMethod", a.formMethod, a, null), $(e, t, "formTarget", a.formTarget, a, null)) : ($(e, t, "encType", a.encType, a, null), $(e, t, "method", a.method, a, null), $(e, t, "target", a.target, a, null))), r == null || typeof r == "symbol" || typeof r == "boolean") {
					e.removeAttribute(n);
					break;
				}
				r = L(r), e.setAttribute(n, r);
				break;
			case "onClick":
				r != null && (e.onclick = R);
				return;
			case "onScroll":
				r != null && Q("scroll", e);
				return;
			case "onScrollEnd":
				r != null && Q("scrollend", e);
				return;
			case "dangerouslySetInnerHTML":
				if (r != null) {
					if (typeof r != "object" || !("__html" in r)) throw Error(i(61));
					if (n = r.__html, n != null) {
						if (a.children != null) throw Error(i(60));
						o?.__html !== n && (e.innerHTML = n);
					}
				}
				break;
			case "multiple":
				e.multiple = r && typeof r != "function" && typeof r != "symbol";
				break;
			case "muted":
				e.muted = r && typeof r != "function" && typeof r != "symbol";
				break;
			case "suppressContentEditableWarning":
			case "suppressHydrationWarning":
			case "defaultValue":
			case "defaultChecked":
			case "innerHTML":
			case "ref": break;
			case "autoFocus": break;
			case "xlinkHref":
				if (r == null || typeof r == "function" || typeof r == "boolean" || typeof r == "symbol") {
					e.removeAttribute("xlink:href");
					break;
				}
				n = L(r), e.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", n);
				break;
			case "contentEditable":
			case "spellCheck":
			case "draggable":
			case "value":
			case "autoReverse":
			case "externalResourcesRequired":
			case "focusable":
			case "preserveAlpha":
				r != null && typeof r != "function" && typeof r != "symbol" ? e.setAttribute(n, r) : e.removeAttribute(n);
				break;
			case "inert":
			case "allowFullScreen":
			case "async":
			case "autoPlay":
			case "controls":
			case "credentialless":
			case "default":
			case "defer":
			case "disabled":
			case "disablePictureInPicture":
			case "disableRemotePlayback":
			case "formNoValidate":
			case "hidden":
			case "loop":
			case "noModule":
			case "noValidate":
			case "open":
			case "playsInline":
			case "readOnly":
			case "required":
			case "reversed":
			case "scoped":
			case "seamless":
			case "itemScope":
				r && typeof r != "function" && typeof r != "symbol" ? e.setAttribute(n, "") : e.removeAttribute(n);
				break;
			case "capture":
			case "download":
				!0 === r ? e.setAttribute(n, "") : !1 !== r && r != null && typeof r != "function" && typeof r != "symbol" ? e.setAttribute(n, r) : e.removeAttribute(n);
				break;
			case "cols":
			case "rows":
			case "size":
			case "span":
				r != null && typeof r != "function" && typeof r != "symbol" && !isNaN(r) && 1 <= r ? e.setAttribute(n, r) : e.removeAttribute(n);
				break;
			case "rowSpan":
			case "start":
				r == null || typeof r == "function" || typeof r == "symbol" || isNaN(r) ? e.removeAttribute(n) : e.setAttribute(n, r);
				break;
			case "popover":
				Q("beforetoggle", e), Q("toggle", e), Zt(e, "popover", r);
				break;
			case "xlinkActuate":
				$t(e, "http://www.w3.org/1999/xlink", "xlink:actuate", r);
				break;
			case "xlinkArcrole":
				$t(e, "http://www.w3.org/1999/xlink", "xlink:arcrole", r);
				break;
			case "xlinkRole":
				$t(e, "http://www.w3.org/1999/xlink", "xlink:role", r);
				break;
			case "xlinkShow":
				$t(e, "http://www.w3.org/1999/xlink", "xlink:show", r);
				break;
			case "xlinkTitle":
				$t(e, "http://www.w3.org/1999/xlink", "xlink:title", r);
				break;
			case "xlinkType":
				$t(e, "http://www.w3.org/1999/xlink", "xlink:type", r);
				break;
			case "xmlBase":
				$t(e, "http://www.w3.org/XML/1998/namespace", "xml:base", r);
				break;
			case "xmlLang":
				$t(e, "http://www.w3.org/XML/1998/namespace", "xml:lang", r);
				break;
			case "xmlSpace":
				$t(e, "http://www.w3.org/XML/1998/namespace", "xml:space", r);
				break;
			case "is":
				Zt(e, "is", r);
				break;
			case "innerText":
			case "textContent": return;
			default: if (!(2 < n.length) || n[0] !== "o" && n[0] !== "O" || n[1] !== "n" && n[1] !== "N") n = vn.get(n) || n, Zt(e, n, r);
			else return;
		}
		F = !0;
	}
	function tp(e, t, n, r, a, o) {
		switch (n) {
			case "style":
				I(e, r, o);
				return;
			case "dangerouslySetInnerHTML":
				if (r != null) {
					if (typeof r != "object" || !("__html" in r)) throw Error(i(61));
					if (n = r.__html, n != null) {
						if (a.children != null) throw Error(i(60));
						o?.__html !== n && (e.innerHTML = n);
					}
				}
				break;
			case "children":
				if (typeof r == "string") mn(e, r);
				else if (typeof r == "number" || typeof r == "bigint") mn(e, "" + r);
				else return;
				break;
			case "onScroll":
				r != null && Q("scroll", e);
				return;
			case "onScrollEnd":
				r != null && Q("scrollend", e);
				return;
			case "onClick":
				r != null && (e.onclick = R);
				return;
			case "suppressContentEditableWarning":
			case "suppressHydrationWarning":
			case "innerHTML":
			case "ref": return;
			case "innerText":
			case "textContent": return;
			default:
				if (!Ut.hasOwnProperty(n)) a: {
					if (n[0] === "o" && n[1] === "n" && (a = n.endsWith("Capture"), o = n.slice(2, a ? n.length - 7 : void 0), t = e[Dt] || null, t = t == null ? null : t[n], typeof t == "function" && e.removeEventListener(o, t, a), typeof r == "function")) {
						typeof t != "function" && t !== null && (n in e ? e[n] = null : e.hasAttribute(n) && e.removeAttribute(n)), e.addEventListener(o, r, a);
						break a;
					}
					F = !0, n in e ? e[n] = r : !0 === r ? e.setAttribute(n, "") : Zt(e, n, r);
				}
				return;
		}
		F = !0;
	}
	function np(e, t, n) {
		switch (t) {
			case "div":
			case "span":
			case "svg":
			case "path":
			case "a":
			case "g":
			case "p":
			case "li": break;
			case "img":
				Q("error", e), Q("load", e);
				var r = !1, a = !1, o;
				for (o in n) if (n.hasOwnProperty(o)) {
					var s = n[o];
					if (s != null) switch (o) {
						case "src":
							r = !0;
							break;
						case "srcSet":
							a = !0;
							break;
						case "children":
						case "dangerouslySetInnerHTML": throw Error(i(137, t));
						default: $(e, t, o, s, n, null);
					}
				}
				a && $(e, t, "srcSet", n.srcSet, n, null), r && $(e, t, "src", n.src, n, null);
				return;
			case "input":
				Q("invalid", e);
				var c = o = s = a = null, l = null, u = null;
				for (r in n) if (n.hasOwnProperty(r)) {
					var d = n[r];
					if (d != null) switch (r) {
						case "name":
							a = d;
							break;
						case "type":
							s = d;
							break;
						case "checked":
							l = d;
							break;
						case "defaultChecked":
							u = d;
							break;
						case "value":
							o = d;
							break;
						case "defaultValue":
							c = d;
							break;
						case "children":
						case "dangerouslySetInnerHTML":
							if (d != null) throw Error(i(137, t));
							break;
						default: $(e, t, r, d, n, null);
					}
				}
				ln(e, o, c, l, u, s, a, !1);
				return;
			case "select":
				for (a in Q("invalid", e), r = s = o = null, n) if (n.hasOwnProperty(a) && (c = n[a], c != null)) switch (a) {
					case "value":
						o = c;
						break;
					case "defaultValue":
						s = c;
						break;
					case "multiple": r = c;
					default: $(e, t, a, c, n, null);
				}
				t = o, n = s, e.multiple = !!r, t == null ? n != null && dn(e, !!r, n, !0) : dn(e, !!r, t, !1);
				return;
			case "textarea":
				for (s in Q("invalid", e), o = a = r = null, n) if (n.hasOwnProperty(s) && (c = n[s], c != null)) switch (s) {
					case "value":
						r = c;
						break;
					case "defaultValue":
						a = c;
						break;
					case "children":
						o = c;
						break;
					case "dangerouslySetInnerHTML":
						if (c != null) throw Error(i(91));
						break;
					default: $(e, t, s, c, n, null);
				}
				pn(e, r, a, o);
				return;
			case "option":
				for (l in n) if (n.hasOwnProperty(l) && (r = n[l], r != null)) switch (l) {
					case "selected":
						e.selected = r && typeof r != "function" && typeof r != "symbol";
						break;
					default: $(e, t, l, r, n, null);
				}
				return;
			case "dialog":
				Q("beforetoggle", e), Q("toggle", e), Q("cancel", e), Q("close", e);
				break;
			case "iframe":
			case "object":
				Q("load", e);
				break;
			case "video":
			case "audio":
				for (r = 0; r < zf.length; r++) Q(zf[r], e);
				break;
			case "image":
				Q("error", e), Q("load", e);
				break;
			case "details":
				Q("toggle", e);
				break;
			case "embed":
			case "source":
			case "link": Q("error", e), Q("load", e);
			case "area":
			case "base":
			case "br":
			case "col":
			case "hr":
			case "keygen":
			case "meta":
			case "param":
			case "track":
			case "wbr":
			case "menuitem":
				for (u in n) if (n.hasOwnProperty(u) && (r = n[u], r != null)) switch (u) {
					case "children":
					case "dangerouslySetInnerHTML": throw Error(i(137, t));
					default: $(e, t, u, r, n, null);
				}
				return;
			default: if (_n(t)) {
				for (d in n) n.hasOwnProperty(d) && (r = n[d], r !== void 0 && tp(e, t, d, r, n, void 0));
				return;
			}
		}
		for (c in n) n.hasOwnProperty(c) && (r = n[c], r != null && $(e, t, c, r, n, null));
	}
	var rp = {};
	function ip(e, t, n, r) {
		switch (t) {
			case "div":
			case "span":
			case "svg":
			case "path":
			case "a":
			case "g":
			case "p":
			case "li": break;
			case "input":
				var a = null, o = null, s = null, c = null, l = null, u = null, d = null;
				for (m in n) {
					var f = n[m];
					if (n.hasOwnProperty(m) && f != null) switch (m) {
						case "checked": break;
						case "value": break;
						case "defaultValue": l = f;
						default: r.hasOwnProperty(m) || $(e, t, m, null, r, f);
					}
				}
				for (var p in r) {
					var m = r[p];
					if (f = n[p], r.hasOwnProperty(p) && (m != null || f != null)) switch (p) {
						case "type":
							m !== f && (F = !0), o = m;
							break;
						case "name":
							m !== f && (F = !0), a = m;
							break;
						case "checked":
							m !== f && (F = !0), u = m;
							break;
						case "defaultChecked":
							m !== f && (F = !0), d = m;
							break;
						case "value":
							m !== f && (F = !0), s = m;
							break;
						case "defaultValue":
							m !== f && (F = !0), c = m;
							break;
						case "children":
						case "dangerouslySetInnerHTML":
							if (m != null) throw Error(i(137, t));
							break;
						default: m !== f && $(e, t, p, m, r, f);
					}
				}
				cn(e, s, c, l, u, d, o, a);
				return;
			case "select":
				for (o in m = s = c = p = null, n) if (l = n[o], n.hasOwnProperty(o) && l != null) switch (o) {
					case "value": break;
					case "multiple": m = l;
					default: r.hasOwnProperty(o) || $(e, t, o, null, r, l);
				}
				for (a in r) if (o = r[a], l = n[a], r.hasOwnProperty(a) && (o != null || l != null)) switch (a) {
					case "value":
						o !== l && (F = !0), p = o;
						break;
					case "defaultValue":
						o !== l && (F = !0), c = o;
						break;
					case "multiple": o !== l && (F = !0), s = o;
					default: o !== l && $(e, t, a, o, r, l);
				}
				t = c, n = s, r = m, p == null ? !!r != !!n && (t == null ? dn(e, !!n, n ? [] : "", !1) : dn(e, !!n, t, !0)) : dn(e, !!n, p, !1);
				return;
			case "textarea":
				for (c in m = p = null, n) if (a = n[c], n.hasOwnProperty(c) && a != null && !r.hasOwnProperty(c)) switch (c) {
					case "value": break;
					case "children": break;
					default: $(e, t, c, null, r, a);
				}
				for (s in r) if (a = r[s], o = n[s], r.hasOwnProperty(s) && (a != null || o != null)) switch (s) {
					case "value":
						a !== o && (F = !0), p = a;
						break;
					case "defaultValue":
						a !== o && (F = !0), m = a;
						break;
					case "children": break;
					case "dangerouslySetInnerHTML":
						if (a != null) throw Error(i(91));
						break;
					default: a !== o && $(e, t, s, a, r, o);
				}
				fn(e, p, m);
				return;
			case "option":
				for (var h in n) if (p = n[h], n.hasOwnProperty(h) && p != null && !r.hasOwnProperty(h)) switch (h) {
					case "selected":
						e.selected = !1;
						break;
					default: $(e, t, h, null, r, p);
				}
				for (l in r) if (p = r[l], m = n[l], r.hasOwnProperty(l) && p !== m && (p != null || m != null)) switch (l) {
					case "selected":
						p !== m && (F = !0), e.selected = p && typeof p != "function" && typeof p != "symbol";
						break;
					default: $(e, t, l, p, r, m);
				}
				return;
			case "img":
			case "link":
			case "area":
			case "base":
			case "br":
			case "col":
			case "embed":
			case "hr":
			case "keygen":
			case "meta":
			case "param":
			case "source":
			case "track":
			case "wbr":
			case "menuitem":
				for (var g in n) p = n[g], n.hasOwnProperty(g) && p != null && !r.hasOwnProperty(g) && $(e, t, g, null, r, p);
				for (u in r) if (p = r[u], m = n[u], r.hasOwnProperty(u) && p !== m && (p != null || m != null)) switch (u) {
					case "children":
					case "dangerouslySetInnerHTML":
						if (p != null) throw Error(i(137, t));
						break;
					default: $(e, t, u, p, r, m);
				}
				return;
			default: if (_n(t)) {
				for (var _ in n) p = n[_], n.hasOwnProperty(_) && p !== void 0 && !r.hasOwnProperty(_) && tp(e, t, _, void 0, r, p);
				for (d in r) p = r[d], m = n[d], !r.hasOwnProperty(d) || p === m || p === void 0 && m === void 0 || tp(e, t, d, p, r, m);
				return;
			}
		}
		for (var v in n) p = n[v], n.hasOwnProperty(v) && p != null && !r.hasOwnProperty(v) && $(e, t, v, null, r, p);
		for (f in r) p = r[f], m = n[f], !r.hasOwnProperty(f) || p === m || p == null && m == null || $(e, t, f, p, r, m);
	}
	function ap(e) {
		switch (e) {
			case "css":
			case "script":
			case "font":
			case "img":
			case "image":
			case "input":
			case "link": return !0;
			default: return !1;
		}
	}
	function op() {
		if (typeof performance.getEntriesByType == "function") {
			for (var e = 0, t = 0, n = performance.getEntriesByType("resource"), r = 0; r < n.length; r++) {
				var i = n[r], a = i.transferSize, o = i.initiatorType, s = i.duration;
				if (a && s && ap(o)) {
					for (o = 0, s = i.responseEnd, r += 1; r < n.length; r++) {
						var c = n[r], l = c.startTime;
						if (l > s) break;
						var u = c.transferSize, d = c.initiatorType;
						u && ap(d) && (c = c.responseEnd, o += u * (c < s ? 1 : (s - l) / (c - l)));
					}
					if (--r, t += 8 * (a + o) / (i.duration / 1e3), e++, 10 < e) break;
				}
			}
			if (0 < e) return t / e / 1e6;
		}
		return navigator.connection && (e = navigator.connection.downlink, typeof e == "number") ? e : 5;
	}
	var sp = null, cp = null;
	function lp(e) {
		return e.nodeType === 9 ? e : e.ownerDocument;
	}
	function up(e) {
		switch (e) {
			case "http://www.w3.org/2000/svg": return 1;
			case "http://www.w3.org/1998/Math/MathML": return 2;
			default: return 0;
		}
	}
	function dp(e, t) {
		if (e === 0) switch (t) {
			case "svg": return 1;
			case "math": return 2;
			default: return 0;
		}
		return e === 1 && t === "foreignObject" ? 0 : e;
	}
	function fp(e, t, n, r) {
		return n = lp(n).createElement(e), n[Et] = r, n[Dt] = t, np(n, e, t), Bt(n), n;
	}
	function pp(e, t) {
		return e === "textarea" || e === "noscript" || typeof t.children == "string" || typeof t.children == "number" || typeof t.children == "bigint" || typeof t.dangerouslySetInnerHTML == "object" && t.dangerouslySetInnerHTML !== null && t.dangerouslySetInnerHTML.__html != null;
	}
	var mp = null;
	function hp() {
		var e = window.event;
		return e && e.type === "popstate" ? e !== mp && (mp = e, !0) : (mp = null, !1);
	}
	var gp = typeof setTimeout == "function" ? setTimeout : void 0, _p = typeof clearTimeout == "function" ? clearTimeout : void 0, vp = typeof Promise == "function" ? Promise : void 0, yp = typeof requestAnimationFrame == "function" ? requestAnimationFrame : gp, bp = typeof queueMicrotask == "function" ? queueMicrotask : vp === void 0 ? gp : function(e) {
		return vp.resolve(null).then(e).catch(xp);
	};
	function xp(e) {
		setTimeout(function() {
			throw e;
		});
	}
	function Sp(e) {
		return e === "head";
	}
	function Cp(e, t) {
		var n = t, r = 0;
		do {
			var i = n.nextSibling;
			if (e.removeChild(n), i && i.nodeType === 8) {
				if (n = i.data, n === "/$" || n === "/&") {
					if (r === 0) {
						e.removeChild(i), Hh(t);
						return;
					}
					r--;
				} else if (n === "$" || n === "$?" || n === "$~" || n === "$!" || n === "&") r++;
				else if (n === "html") _m(e.ownerDocument.documentElement);
				else if (n === "head") {
					n = e.ownerDocument.head, _m(n);
					for (var a = n.firstChild; a;) {
						var o = a.nextSibling, s = a.nodeName;
						a[Nt] || s === "SCRIPT" || s === "STYLE" || s === "LINK" && a.rel.toLowerCase() === "stylesheet" || n.removeChild(a), a = o;
					}
				} else n === "body" && _m(e.ownerDocument.body);
			}
			n = i;
		} while (n);
		Hh(t);
	}
	function wp(e, t) {
		var n = e;
		e = 0;
		do {
			var r = n.nextSibling;
			if (n.nodeType === 1 ? t ? (n._stashedDisplay = n.style.display, n.style.display = "none") : (n.style.display = n._stashedDisplay || "", n.getAttribute("style") === "" && n.removeAttribute("style")) : n.nodeType === 3 && (t ? (n._stashedText = n.nodeValue, n.nodeValue = "") : n.nodeValue = n._stashedText || ""), r && r.nodeType === 8) {
				if (n = r.data, n === "/$") {
					if (e === 0) break;
					e--;
				} else n !== "$" && n !== "$?" && n !== "$~" && n !== "$!" || e++;
			}
			n = r;
		} while (n);
	}
	function Tp(e, t, n) {
		if (t = CSS.escape(t) === t ? t : "r-" + btoa(t).replace(/=/g, ""), e.style.viewTransitionName = t, n != null && (e.style.viewTransitionClass = n), n = getComputedStyle(e), n.display === "inline") {
			if (t = e.getClientRects(), t.length === 1) var r = 1;
			else for (var i = r = 0; i < t.length; i++) {
				var a = t[i];
				0 < a.width && 0 < a.height && r++;
			}
			r === 1 && (e = e.style, e.display = t.length === 1 ? "inline-block" : "block", e.marginTop = "-" + n.paddingTop, e.marginBottom = "-" + n.paddingBottom);
		}
	}
	function Ep(e, t) {
		e = e.style, t = t.style;
		var n = t == null ? null : t.hasOwnProperty("viewTransitionName") ? t.viewTransitionName : t.hasOwnProperty("view-transition-name") ? t["view-transition-name"] : null;
		e.viewTransitionName = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), n = t == null ? null : t.hasOwnProperty("viewTransitionClass") ? t.viewTransitionClass : t.hasOwnProperty("view-transition-class") ? t["view-transition-class"] : null, e.viewTransitionClass = n == null || typeof n == "boolean" ? "" : ("" + n).trim(), e.display === "inline-block" && (t == null ? e.display = e.margin = "" : (n = t.display, e.display = n == null || typeof n == "boolean" ? "" : n, n = t.margin, n == null ? (n = t.hasOwnProperty("marginTop") ? t.marginTop : t["margin-top"], e.marginTop = n == null || typeof n == "boolean" ? "" : n, t = t.hasOwnProperty("marginBottom") ? t.marginBottom : t["margin-bottom"], e.marginBottom = t == null || typeof t == "boolean" ? "" : t) : e.margin = n));
	}
	function Dp(e, t, n) {
		return n = n.ownerDocument.defaultView, {
			rect: e,
			abs: t.position === "absolute" || t.position === "fixed",
			clip: t.clipPath !== "none" || t.overflow !== "visible" || t.filter !== "none" || t.mask !== "none" || t.mask !== "none" || t.borderRadius !== "0px",
			view: 0 <= e.bottom && 0 <= e.right && e.top <= n.innerHeight && e.left <= n.innerWidth
		};
	}
	function Op(e) {
		return Dp(e.getBoundingClientRect(), getComputedStyle(e), e);
	}
	function kp(e) {
		var t = e.getBoundingClientRect();
		t = new DOMRect(t.x + 2e4, t.y + 2e4, t.width, t.height);
		var n = getComputedStyle(e);
		return Dp(t, n, e);
	}
	function Ap(e) {
		return e.documentElement.clientHeight;
	}
	function jp(e) {
		this.addEventListener("load", e), this.addEventListener("error", e);
	}
	function Mp(e, t, n, r, i, a, o, s, c) {
		var l = t.nodeType === 9 ? t : t.ownerDocument;
		try {
			var u = l.startViewTransition({
				update: function() {
					var t = l.defaultView, n = t.navigation && t.navigation.transition, o = l.fonts.status;
					r();
					var s = [];
					if (o === "loaded" && (Ap(l), l.fonts.status === "loading" && s.push(l.fonts.ready)), o = s.length, e !== null) for (var c = e.suspenseyImages, u = 0, d = 0; d < c.length; d++) {
						var f = c[d];
						if (!f.complete) {
							var p = f.getBoundingClientRect();
							if (0 < p.bottom && 0 < p.right && p.top < t.innerHeight && p.left < t.innerWidth) {
								if (u += Xm(f), u > $m) {
									s.length = o;
									break;
								}
								f = new Promise(jp.bind(f)), s.push(f);
							}
						}
					}
					if (0 < s.length) return t = Promise.race([Promise.all(s), new Promise(function(e) {
						return setTimeout(e, 500);
					})]).then(i, i), (n ? Promise.allSettled([n.finished, t]) : t).then(a, a);
					if (i(), n) return n.finished.then(a, a);
					a();
				},
				types: n
			});
			l.__reactViewTransition = u;
			var d = [];
			return u.ready.then(function() {
				for (var e = l.documentElement.getAnimations({ subtree: !0 }), t = 0; t < e.length; t++) {
					var n = e[t], r = n.effect, i = r.pseudoElement;
					if (i != null && i.startsWith("::view-transition")) {
						d.push(n), n = r.getKeyframes();
						for (var a = i = void 0, s = !0, c = 0; c < n.length; c++) {
							var u = n[c], f = u.width;
							if (i === void 0) i = f;
							else if (i !== f) {
								s = !1;
								break;
							}
							if (f = u.height, a === void 0) a = f;
							else if (a !== f) {
								s = !1;
								break;
							}
							delete u.width, delete u.height, u.transform === "none" && delete u.transform;
						}
						s && i !== void 0 && a !== void 0 && (r.setKeyframes(n), s = getComputedStyle(r.target, r.pseudoElement), s.width !== i || s.height !== a) && (s = n[0], s.width = i, s.height = a, s = n[n.length - 1], s.width = i, s.height = a, r.setKeyframes(n));
					}
				}
				o();
			}, function(e) {
				l.__reactViewTransition === u && (l.__reactViewTransition = null);
				try {
					if (typeof e == "object" && e) switch (e.name) {
						case "InvalidStateError": (e.message === "View transition was skipped because document visibility state is hidden." || e.message === "Skipping view transition because document visibility state has become hidden." || e.message === "Skipping view transition because viewport size changed." || e.message === "Transition was aborted because of invalid state") && (e = null);
					}
					e !== null && c(e);
				} finally {
					r(), i(), o();
				}
			}), u.finished.finally(function() {
				for (var e = 0; e < d.length; e++) d[e].cancel();
				l.__reactViewTransition === u && (l.__reactViewTransition = null), s();
			}), u;
		} catch {
			return r(), i(), o(), null;
		}
	}
	function Np(e, t) {
		this._scope = document.documentElement, this._selector = "::view-transition-" + e + "(" + t + ")";
	}
	Np.prototype.animate = function(e, t) {
		return t = typeof t == "number" ? { duration: t } : T({}, t), t.pseudoElement = this._selector, this._scope.animate(e, t);
	}, Np.prototype.getAnimations = function() {
		for (var e = this._scope, t = this._selector, n = e.getAnimations({ subtree: !0 }), r = [], i = 0; i < n.length; i++) {
			var a = n[i].effect;
			a !== null && a.target === e && a.pseudoElement === t && r.push(n[i]);
		}
		return r;
	}, Np.prototype.getComputedStyle = function() {
		return getComputedStyle(this._scope, this._selector);
	};
	function Pp(e) {
		return {
			name: e,
			group: new Np("group", e),
			imagePair: new Np("image-pair", e),
			old: new Np("old", e),
			new: new Np("new", e)
		};
	}
	function Fp(e) {
		this._fragmentFiber = e, this._observers = this._eventListeners = null;
	}
	Fp.prototype.addEventListener = function(e, t, n) {
		var r = null, i = null;
		if (!(n != null && typeof n != "boolean" && (r = n.signal || null, r !== null && r.aborted))) {
			this._eventListeners === null && (this._eventListeners = []);
			var a = this._eventListeners;
			if (Bp(a, e, t, n) === -1) {
				var o = this, s = t;
				n != null && typeof n != "boolean" && !0 === n.once && (s = function(r) {
					o.removeEventListener(e, t, n), typeof t == "function" ? t.call(this, r) : t.handleEvent(r);
				}), r !== null && (i = o.removeEventListener.bind(o, e, t, n), r.addEventListener("abort", i, { once: !0 }), i = r.removeEventListener.bind(r, "abort", i)), r = Rp(n), a.push({
					type: e,
					listener: t,
					optionsOrUseCapture: n,
					attachedListener: s,
					cleanup: i
				}), h(this._fragmentFiber.child, !1, Ip, e, s, r);
			}
			this._eventListeners = a;
		}
	};
	function Ip(e, t, n, r) {
		return b(e).addEventListener(t, n, r), !1;
	}
	Fp.prototype.removeEventListener = function(e, t, n) {
		var r = this._eventListeners;
		if (r !== null && (t = Bp(r, e, t, n), t !== -1)) {
			var i = r[t];
			n = i.attachedListener;
			var a = i.cleanup;
			i = Rp(i.optionsOrUseCapture), h(this._fragmentFiber.child, !1, Lp, e, n, i), r.splice(t, 1), a !== null && a();
		}
	};
	function Lp(e, t, n, r) {
		return b(e).removeEventListener(t, n, r), !1;
	}
	function Rp(e) {
		return e != null && typeof e != "boolean" && (!0 === e.once || e.signal instanceof AbortSignal) ? {
			capture: e.capture,
			passive: e.passive
		} : e;
	}
	function zp(e) {
		return e == null ? "c=0" : typeof e == "boolean" ? "c=" + (e ? "1" : "0") : "c=" + (e.capture ? "1" : "0");
	}
	function Bp(e, t, n, r) {
		if (e.length === 0) return -1;
		r = zp(r);
		for (var i = 0; i < e.length; i++) {
			var a = e[i];
			if (a.type === t && a.listener === n && zp(a.optionsOrUseCapture) === r) return i;
		}
		return -1;
	}
	Fp.prototype.dispatchEvent = function(e) {
		var t = g(this._fragmentFiber);
		if (t === null) return !0;
		t = b(t);
		var n = this._eventListeners;
		if (n !== null && 0 < n.length || !e.bubbles) {
			var r = t.nodeType === 9 ? t.createComment("") : document.createTextNode("");
			if (n) for (var i = 0; i < n.length; i++) {
				var a = n[i];
				r.addEventListener(a.type, a.attachedListener, Rp(a.optionsOrUseCapture));
			}
			if (t.appendChild(r), e = r.dispatchEvent(e), n) for (i = 0; i < n.length; i++) a = n[i], r.removeEventListener(a.type, a.attachedListener, Rp(a.optionsOrUseCapture));
			return t.removeChild(r), e;
		}
		return t.dispatchEvent(e);
	}, Fp.prototype.focus = function(e) {
		h(this._fragmentFiber.child, !0, Vp, e, void 0, void 0);
	};
	function Vp(e, t) {
		return e.tag !== 6 && (e = b(e), pm(e, t));
	}
	Fp.prototype.focusLast = function(e) {
		var t = [];
		h(this._fragmentFiber.child, !0, Hp, t, void 0, void 0);
		for (var n = t.length - 1; 0 <= n && !Vp(t[n], e); n--);
	};
	function Hp(e, t) {
		return t.push(e), !1;
	}
	Fp.prototype.blur = function() {
		var e = g(this._fragmentFiber);
		e !== null && (e = b(e), e = lp(e).activeElement, e !== null && h(this._fragmentFiber.child, !1, Up, e, void 0, void 0));
	};
	function Up(e, t) {
		return e.tag !== 6 && (e = b(e), e === t || e.contains(t) ? (t.blur(), !0) : !1);
	}
	Fp.prototype.observeUsing = function(e) {
		this._observers === null && (this._observers = /* @__PURE__ */ new Set()), this._observers.add(e), h(this._fragmentFiber.child, !1, Wp, e, void 0, void 0);
	};
	function Wp(e, t) {
		return e.tag === 6 || (e = b(e), t.observe(e)), !1;
	}
	Fp.prototype.unobserveUsing = function(e) {
		var t = this._observers;
		if (t !== null && t.has(e)) {
			t.delete(e), h(this._fragmentFiber.child, !1, Gp, e, void 0, void 0);
			for (var n = t = 0; n < Kp.length; n++) {
				var r = Kp[n];
				r.fragmentInstance === this && r.observer === e ? e.unobserve(r.instance) : Kp[t++] = r;
			}
			Kp.length = t;
		}
	};
	function Gp(e, t) {
		return e.tag === 6 || (e = b(e), t.unobserve(e)), !1;
	}
	var Kp = [], qp = !1;
	function Jp(e, t, n) {
		Kp.push({
			fragmentInstance: e,
			observer: t,
			instance: n
		}), qp || (qp = !0, mm(function() {
			qp = !1;
			var e = Kp;
			Kp = [];
			for (var t = 0; t < e.length; t++) {
				var n = e[t];
				n.observer.unobserve(n.instance);
			}
		}));
	}
	Fp.prototype.getClientRects = function() {
		var e = [];
		return h(this._fragmentFiber.child, !1, Yp, e, void 0, void 0), e;
	};
	function Yp(e, t) {
		if (e.tag === 6) {
			e = e.stateNode;
			var n = e.ownerDocument.createRange();
			n.selectNodeContents(e), t.push.apply(t, n.getClientRects());
		} else e = b(e), t.push.apply(t, e.getClientRects());
		return !1;
	}
	Fp.prototype.getRootNode = function(e) {
		var t = g(this._fragmentFiber);
		return t === null ? this : b(t).getRootNode(e);
	}, Fp.prototype.compareDocumentPosition = function(e) {
		var t = g(this._fragmentFiber);
		if (t === null) return Node.DOCUMENT_POSITION_DISCONNECTED;
		var n = [];
		h(this._fragmentFiber.child, !1, Hp, n, void 0, void 0);
		var r = b(t);
		if (n.length === 0) {
			if (n = r, _(this._fragmentFiber)) {
				a: {
					for (t = this._fragmentFiber.return; t !== null;) {
						if (t.tag === 4) {
							t = t.stateNode.containerInfo;
							break a;
						}
						if (t.tag === 3 || t.tag === 5 || t.tag === 27) break;
						t = t.return;
					}
					t = null;
				}
				t != null && (n = t);
			}
			t = this._fragmentFiber;
			var i = r = n.compareDocumentPosition(e);
			return n === e ? i = Node.DOCUMENT_POSITION_CONTAINS : r & Node.DOCUMENT_POSITION_CONTAINED_BY && (n = v(t)[1], n === null ? i = Node.DOCUMENT_POSITION_PRECEDING : (e = b(n).compareDocumentPosition(e), i = e === 0 || e & Node.DOCUMENT_POSITION_FOLLOWING ? Node.DOCUMENT_POSITION_FOLLOWING : Node.DOCUMENT_POSITION_PRECEDING)), i |= Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
		}
		t = b(n[0]), i = b(n[n.length - 1]);
		var a = _(this._fragmentFiber) ? t.parentElement : r;
		if (a == null) return Node.DOCUMENT_POSITION_DISCONNECTED;
		r = a.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_CONTAINED_BY, a = a.compareDocumentPosition(i) & Node.DOCUMENT_POSITION_CONTAINED_BY;
		var o = t.compareDocumentPosition(e), s = i.compareDocumentPosition(e), c = o & Node.DOCUMENT_POSITION_CONTAINED_BY || s & Node.DOCUMENT_POSITION_CONTAINED_BY;
		return s = r && a && o & Node.DOCUMENT_POSITION_FOLLOWING && s & Node.DOCUMENT_POSITION_PRECEDING, t = r && t === e || a && i === e || c || s ? Node.DOCUMENT_POSITION_CONTAINED_BY : !r && t === e || !a && i === e ? Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC : o, t & Node.DOCUMENT_POSITION_DISCONNECTED || t & Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC || Xp(t, this._fragmentFiber, n[0], n[n.length - 1], e) ? t : Node.DOCUMENT_POSITION_IMPLEMENTATION_SPECIFIC;
	};
	function Xp(e, t, n, r, i) {
		var a = It(i);
		if (e & Node.DOCUMENT_POSITION_CONTAINED_BY) {
			if (n = !!a) a: {
				for (; a !== null;) {
					if (a.tag === 7 && (a === t || a.alternate === t)) {
						n = !0;
						break a;
					}
					a = a.return;
				}
				n = !1;
			}
			return n;
		}
		if (e & Node.DOCUMENT_POSITION_CONTAINS) {
			if (a === null) return a = i.ownerDocument, i === a || i === a.documentElement || i === a.body;
			a: {
				for (a = t, t = g(t); a !== null;) {
					if (!(a.tag !== 5 && a.tag !== 3 && a.tag !== 27 || a !== t && a.alternate !== t)) {
						a = !0;
						break a;
					}
					a = a.return;
				}
				a = !1;
			}
			return a;
		}
		return e & Node.DOCUMENT_POSITION_PRECEDING ? ((t = !!a) && !(t = a === n) && (t = te(n, a, w), t === null ? t = !1 : (h(t, !0, C, a, n), a = x, x = null, t = a !== null)), t) : e & Node.DOCUMENT_POSITION_FOLLOWING ? ((t = !!a) && !(t = a === r) && (t = te(r, a, w), t === null ? t = !1 : (h(t, !0, ee, a, r), a = x, S = x = null, t = a !== null)), t) : !1;
	}
	function Zp(e, t) {
		var n = e.ownerDocument.createRange();
		n.selectNodeContents(e), e = n.getBoundingClientRect(), window.scrollTo(window.scrollX + e.left, t ? window.scrollY + e.top : window.scrollY + e.bottom - window.innerHeight);
	}
	Fp.prototype.scrollIntoView = function(e) {
		if (typeof e == "object") throw Error(i(566));
		var t = [];
		h(this._fragmentFiber.child, !1, Hp, t, void 0, void 0);
		var n = !1 !== e;
		if (t.length === 0) {
			var r = v(this._fragmentFiber);
			if (r = n ? r[1] || r[0] || g(this._fragmentFiber) : r[0] || r[1], r === null) return;
			if (r.tag === 6) {
				e = b(r), Zp(e, n);
				return;
			}
			if (r = b(r), r.nodeType !== 9) {
				if (r.nodeType === 11) {
					n = "host" in r ? r.host : null, n !== null && n.scrollIntoView(e);
					return;
				}
				r.scrollIntoView(e);
			}
		}
		for (r = n ? t.length - 1 : 0; r !== (n ? -1 : t.length);) {
			var a = t[r];
			a.tag === 6 ? (a = b(a), Zp(a, n)) : b(a).scrollIntoView(e), r += n ? -1 : 1;
		}
	};
	function Qp(e, t) {
		return e = b(e), $p(e, t), !1;
	}
	function $p(e, t) {
		e.reactFragments ??= /* @__PURE__ */ new Set(), e.reactFragments.add(t);
	}
	function em(e, t) {
		var n = t._eventListeners;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var i = n[r];
			e.addEventListener(i.type, i.attachedListener, Rp(i.optionsOrUseCapture));
		}
		e.nodeType !== 3 && (n = t._observers, n !== null && n.forEach(function(n) {
			for (var r = 0, i = 0; i < Kp.length; i++) {
				var a = Kp[i];
				(a.fragmentInstance !== t || a.observer !== n || a.instance !== e) && (Kp[r++] = a);
			}
			Kp.length = r, n.observe(e);
		}), $p(e, t));
	}
	function tm(e, t) {
		var n = t._eventListeners;
		if (n !== null) for (var r = 0; r < n.length; r++) {
			var i = n[r];
			e.removeEventListener(i.type, i.attachedListener, Rp(i.optionsOrUseCapture));
		}
		e.nodeType !== 3 && (n = t._observers, n !== null && n.forEach(function(n) {
			typeof n.rootMargin == "string" ? Jp(t, n, e) : n.unobserve(e);
		}), e.reactFragments != null && e.reactFragments.delete(t));
	}
	function nm(e) {
		var t = e.firstChild;
		for (t && t.nodeType === 10 && (t = t.nextSibling); t;) {
			var n = t;
			switch (t = t.nextSibling, n.nodeName) {
				case "HTML":
				case "HEAD":
				case "BODY":
					nm(n), Ft(n);
					continue;
				case "SCRIPT":
				case "STYLE": continue;
				case "LINK": if (n.rel.toLowerCase() === "stylesheet") continue;
			}
			e.removeChild(n);
		}
	}
	function rm(e, t, n, r) {
		for (; e.nodeType === 1;) {
			var i = n;
			if (e.nodeName.toLowerCase() !== t.toLowerCase()) {
				if (!r && (e.nodeName !== "INPUT" || e.type !== "hidden")) break;
			} else if (!r) {
				if (t === "input" && e.type === "hidden") {
					var a = i.name == null ? null : "" + i.name;
					if (i.type === "hidden" && e.getAttribute("name") === a) return e;
				} else return e;
			} else if (!e[Nt]) switch (t) {
				case "meta":
					if (!e.hasAttribute("itemprop")) break;
					return e;
				case "link":
					if (a = e.getAttribute("rel"), a === "stylesheet" && e.hasAttribute("data-precedence") || a !== i.rel || e.getAttribute("href") !== (i.href == null || i.href === "" ? null : i.href) || e.getAttribute("crossorigin") !== (i.crossOrigin == null ? null : i.crossOrigin) || e.getAttribute("title") !== (i.title == null ? null : i.title)) break;
					return e;
				case "style":
					if (e.hasAttribute("data-precedence")) break;
					return e;
				case "script":
					if (a = e.getAttribute("src"), (a !== (i.src == null ? null : i.src) || e.getAttribute("type") !== (i.type == null ? null : i.type) || e.getAttribute("crossorigin") !== (i.crossOrigin == null ? null : i.crossOrigin)) && a && e.hasAttribute("async") && !e.hasAttribute("itemprop")) break;
					return e;
				default: return e;
			}
			if (e = lm(e.nextSibling), e === null) break;
		}
		return null;
	}
	function im(e, t, n) {
		if (t === "") return null;
		for (; e.nodeType !== 3;) if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !n || (e = lm(e.nextSibling), e === null)) return null;
		return e;
	}
	function am(e, t) {
		for (; e.nodeType !== 8;) if ((e.nodeType !== 1 || e.nodeName !== "INPUT" || e.type !== "hidden") && !t || (e = lm(e.nextSibling), e === null)) return null;
		return e;
	}
	function om(e) {
		return e.data === "$?" || e.data === "$~";
	}
	function sm(e) {
		return e.data === "$!" || e.data === "$?" && e.ownerDocument.readyState !== "loading";
	}
	function cm(e, t) {
		var n = e.ownerDocument;
		if (e.data === "$~") e._reactRetry = t;
		else if (e.data !== "$?" || n.readyState !== "loading") t();
		else {
			var r = function() {
				t(), n.removeEventListener("DOMContentLoaded", r);
			};
			n.addEventListener("DOMContentLoaded", r), e._reactRetry = r;
		}
	}
	function lm(e) {
		for (; e != null; e = e.nextSibling) {
			var t = e.nodeType;
			if (t === 1 || t === 3) break;
			if (t === 8) {
				if (t = e.data, t === "$" || t === "$!" || t === "$?" || t === "$~" || t === "&" || t === "F!" || t === "F") break;
				if (t === "/$" || t === "/&") return null;
			}
		}
		return e;
	}
	var um = null;
	function dm(e) {
		e = e.nextSibling;
		for (var t = 0; e;) {
			if (e.nodeType === 8) {
				var n = e.data;
				if (n === "/$" || n === "/&") {
					if (t === 0) return lm(e.nextSibling);
					t--;
				} else n !== "$" && n !== "$!" && n !== "$?" && n !== "$~" && n !== "&" || t++;
			}
			e = e.nextSibling;
		}
		return null;
	}
	function fm(e) {
		e = e.previousSibling;
		for (var t = 0; e;) {
			if (e.nodeType === 8) {
				var n = e.data;
				if (n === "$" || n === "$!" || n === "$?" || n === "$~" || n === "&") {
					if (t === 0) return e;
					t--;
				} else n !== "/$" && n !== "/&" || t++;
			}
			e = e.previousSibling;
		}
		return null;
	}
	function pm(e, t) {
		function n() {
			r = !0;
		}
		if (e.ownerDocument.activeElement === e) return !0;
		var r = !1;
		try {
			e.ownerDocument.addEventListener("focus", n, !0), (e.focus || HTMLElement.prototype.focus).call(e, t);
		} finally {
			e.ownerDocument.removeEventListener("focus", n, !0);
		}
		return r;
	}
	function mm(e) {
		yp(function() {
			yp(function(t) {
				return e(t);
			});
		});
	}
	function hm(e, t, n) {
		switch (t = lp(n), e) {
			case "html":
				if (e = t.documentElement, !e) throw Error(i(452));
				return e;
			case "head":
				if (e = t.head, !e) throw Error(i(453));
				return e;
			case "body":
				if (e = t.body, !e) throw Error(i(454));
				return e;
			default: throw Error(i(451));
		}
	}
	function gm(e, t, n) {
		for (var r in n) {
			var i = n[r];
			n.hasOwnProperty(r) && i != null && $(e, t, r, null, rp, i);
		}
		n.dangerouslySetInnerHTML != null && (e.textContent = ""), e.onclick === R && (e.onclick = null), Ft(e);
	}
	function _m(e) {
		for (var t = e.attributes; t.length;) e.removeAttributeNode(t[0]);
		Ft(e);
	}
	var vm = /* @__PURE__ */ new Map(), ym = /* @__PURE__ */ new Set();
	function bm(e) {
		if (typeof e.getRootNode == "function") {
			var t = e.getRootNode();
			if (t.nodeType === 9 || t.nodeType === 11) return t;
		}
		return e.nodeType === 9 ? e : e.ownerDocument;
	}
	var xm = D.d;
	D.d = {
		f: Sm,
		r: Cm,
		D: Em,
		C: Dm,
		L: Om,
		m: km,
		X: jm,
		S: Am,
		M: Mm
	};
	function Sm() {
		var e = xm.f(), t = zd();
		return e || t;
	}
	function Cm(e) {
		var t = Lt(e);
		t !== null && t.tag === 5 && t.type === "form" ? ec(t) : xm.r(e);
	}
	var wm = typeof document > "u" ? null : document;
	function Tm(e, t, n) {
		var r = wm;
		if (r && typeof t == "string" && t) {
			var i = sn(t);
			i = "link[rel=\"" + e + "\"][href=\"" + i + "\"]", typeof n == "string" && (i += "[crossorigin=\"" + n + "\"]"), ym.has(i) || (ym.add(i), e = {
				rel: e,
				crossOrigin: n,
				href: t
			}, r.querySelector(i) === null && (t = r.createElement("link"), np(t, "link", e), Bt(t), r.head.appendChild(t)));
		}
	}
	function Em(e) {
		xm.D(e), Tm("dns-prefetch", e, null);
	}
	function Dm(e, t) {
		xm.C(e, t), Tm("preconnect", e, t);
	}
	function Om(e, t, n) {
		xm.L(e, t, n);
		var r = wm;
		if (r && e && t) {
			var i = "link[rel=\"preload\"][as=\"" + sn(t) + "\"]";
			t === "image" && n && n.imageSrcSet ? (i += "[imagesrcset=\"" + sn(n.imageSrcSet) + "\"]", typeof n.imageSizes == "string" && (i += "[imagesizes=\"" + sn(n.imageSizes) + "\"]")) : i += "[href=\"" + sn(e) + "\"]";
			var a = i;
			switch (t) {
				case "style":
					a = Pm(e);
					break;
				case "script": a = Rm(e);
			}
			if (!(vm.has(a) || (e = T({
				rel: "preload",
				href: t === "image" && n && n.imageSrcSet ? void 0 : e,
				as: t
			}, n), vm.set(a, e), r.querySelector(i) !== null || t === "style" && r.querySelector(Fm(a)) || t === "script" && r.querySelector(zm(a))))) {
				var o = r.createElement("link");
				np(o, "link", e), t === "style" && (o[Pt] = !0, o.onload = o.onerror = function() {
					Vt(o);
				}), Bt(o), r.head.appendChild(o);
			}
		}
	}
	function km(e, t) {
		xm.m(e, t);
		var n = wm;
		if (n && e) {
			var r = t && typeof t.as == "string" ? t.as : "script", i = "link[rel=\"modulepreload\"][as=\"" + sn(r) + "\"][href=\"" + sn(e) + "\"]", a = i;
			switch (r) {
				case "audioworklet":
				case "paintworklet":
				case "serviceworker":
				case "sharedworker":
				case "worker":
				case "script": a = Rm(e);
			}
			if (!vm.has(a) && (e = T({
				rel: "modulepreload",
				href: e
			}, t), vm.set(a, e), n.querySelector(i) === null)) {
				switch (r) {
					case "audioworklet":
					case "paintworklet":
					case "serviceworker":
					case "sharedworker":
					case "worker":
					case "script": if (n.querySelector(zm(a))) return;
				}
				r = n.createElement("link"), np(r, "link", e), Bt(r), n.head.appendChild(r);
			}
		}
	}
	function Am(e, t, n) {
		xm.S(e, t, n);
		var r = wm;
		if (r && e) {
			var i = zt(r).hoistableStyles, a = Pm(e);
			t ||= "default";
			var o = i.get(a);
			if (!o) {
				var s = {
					loading: 0,
					preload: null
				};
				if (o = r.querySelector(Fm(a))) s.loading = 5;
				else {
					e = T({
						rel: "stylesheet",
						href: e,
						"data-precedence": t
					}, n), (n = vm.get(a)) && Hm(e, n);
					var c = o = r.createElement("link");
					Bt(c), np(c, "link", e), c._p = new Promise(function(e, t) {
						c.onload = e, c.onerror = t;
					}), c.addEventListener("load", function() {
						s.loading |= 1;
					}), c.addEventListener("error", function() {
						s.loading |= 2;
					}), s.loading |= 4, Vm(o, t, r);
				}
				o = {
					type: "stylesheet",
					instance: o,
					count: 1,
					state: s
				}, i.set(a, o);
			}
		}
	}
	function jm(e, t) {
		xm.X(e, t);
		var n = wm;
		if (n && e) {
			var r = zt(n).hoistableScripts, i = Rm(e), a = r.get(i);
			a || (a = n.querySelector(zm(i)), a || (e = T({
				src: e,
				async: !0
			}, t), (t = vm.get(i)) && Um(e, t), a = n.createElement("script"), Bt(a), np(a, "link", e), n.head.appendChild(a)), a = {
				type: "script",
				instance: a,
				count: 1,
				state: null
			}, r.set(i, a));
		}
	}
	function Mm(e, t) {
		xm.M(e, t);
		var n = wm;
		if (n && e) {
			var r = zt(n).hoistableScripts, i = Rm(e), a = r.get(i);
			a || (a = n.querySelector(zm(i)), a || (e = T({
				src: e,
				async: !0,
				type: "module"
			}, t), (t = vm.get(i)) && Um(e, t), a = n.createElement("script"), Bt(a), np(a, "link", e), n.head.appendChild(a)), a = {
				type: "script",
				instance: a,
				count: 1,
				state: null
			}, r.set(i, a));
		}
	}
	function Nm(e, t, n, r) {
		var a = (a = Ae.current) ? bm(a) : null;
		if (!a) throw Error(i(446));
		switch (e) {
			case "meta":
			case "title": return null;
			case "style": return typeof n.precedence == "string" && typeof n.href == "string" ? (n = Pm(n.href), t = zt(a).hoistableStyles, r = t.get(n), r || (r = {
				type: "style",
				instance: null,
				count: 0,
				state: null
			}, t.set(n, r)), r) : {
				type: "void",
				instance: null,
				count: 0,
				state: null
			};
			case "link":
				if (n.rel === "stylesheet" && typeof n.href == "string" && typeof n.precedence == "string") {
					e = Pm(n.href);
					var o = zt(a).hoistableStyles, s = o.get(e);
					if (s || (a = a.ownerDocument || a, s = {
						type: "stylesheet",
						instance: null,
						count: 0,
						state: {
							loading: 0,
							preload: null
						}
					}, o.set(e, s), (o = a.querySelector(Fm(e))) ? o._p || (s.instance = o, s.state.loading = 5) : (o = vm.get(e), o || (o = {
						rel: "preload",
						as: "style",
						href: n.href,
						crossOrigin: n.crossOrigin,
						integrity: n.integrity,
						media: n.media,
						hrefLang: n.hrefLang,
						referrerPolicy: n.referrerPolicy
					}, vm.set(e, o)), Lm(a, e, o, s.state))), t && r === null) throw Error(i(528, ""));
					return s;
				}
				if (t && r !== null) throw Error(i(529, ""));
				return null;
			case "script": return t = n.async, n = n.src, typeof n == "string" && t && typeof t != "function" && typeof t != "symbol" ? (n = Rm(n), t = zt(a).hoistableScripts, r = t.get(n), r || (r = {
				type: "script",
				instance: null,
				count: 0,
				state: null
			}, t.set(n, r)), r) : {
				type: "void",
				instance: null,
				count: 0,
				state: null
			};
			default: throw Error(i(444, e));
		}
	}
	function Pm(e) {
		return "href=\"" + sn(e) + "\"";
	}
	function Fm(e) {
		return "link[rel=\"stylesheet\"][" + e + "]";
	}
	function Im(e) {
		return T({}, e, {
			"data-precedence": e.precedence,
			precedence: null
		});
	}
	function Lm(e, t, n, r) {
		if (t = e.querySelector("link[rel=\"preload\"][as=\"style\"][" + t + "]")) {
			if (!0 !== t[Pt]) {
				r.loading = 1;
				return;
			}
		} else t = e.createElement("link"), t[Pt] = !0, t.onload = t.onerror = Vt.bind(null, t), np(t, "link", n), Bt(t), e.head.appendChild(t);
		r.preload = t, t.addEventListener("load", function() {
			return r.loading |= 1;
		}), t.addEventListener("error", function() {
			return r.loading |= 2;
		});
	}
	function Rm(e) {
		return "[src=\"" + sn(e) + "\"]";
	}
	function zm(e) {
		return "script[async]" + e;
	}
	function Bm(e, t, n) {
		if (t.count++, t.instance === null) switch (t.type) {
			case "style":
				var r = e.querySelector("style[data-href~=\"" + sn(n.href) + "\"]");
				if (r) return t.instance = r, Bt(r), r;
				var a = T({}, n, {
					"data-href": n.href,
					"data-precedence": n.precedence,
					href: null,
					precedence: null
				});
				return r = (e.ownerDocument || e).createElement("style"), Bt(r), np(r, "style", a), Vm(r, n.precedence, e), t.instance = r;
			case "stylesheet":
				a = Pm(n.href);
				var o = e.querySelector(Fm(a));
				if (o) return t.state.loading |= 4, t.instance = o, Bt(o), o;
				r = Im(n), (a = vm.get(a)) && Hm(r, a), o = (e.ownerDocument || e).createElement("link"), Bt(o);
				var s = o;
				return s._p = new Promise(function(e, t) {
					s.onload = e, s.onerror = t;
				}), np(o, "link", r), t.state.loading |= 4, Vm(o, n.precedence, e), t.instance = o;
			case "script": return o = Rm(n.src), (a = e.querySelector(zm(o))) ? (t.instance = a, Bt(a), a) : (r = n, (a = vm.get(o)) && (r = T({}, n), Um(r, a)), e = e.ownerDocument || e, a = e.createElement("script"), Bt(a), np(a, "link", r), e.head.appendChild(a), t.instance = a);
			case "void": return null;
			default: throw Error(i(443, t.type));
		}
		else t.type === "stylesheet" && !(t.state.loading & 4) && (r = t.instance, t.state.loading |= 4, Vm(r, n.precedence, e));
		return t.instance;
	}
	function Vm(e, t, n) {
		for (var r = n.querySelectorAll("link[rel=\"stylesheet\"][data-precedence],style[data-precedence]"), i = r.length ? r[r.length - 1] : null, a = i, o = 0; o < r.length; o++) {
			var s = r[o];
			if (s.dataset.precedence === t) a = s;
			else if (a !== i) break;
		}
		a ? a.parentNode.insertBefore(e, a.nextSibling) : (t = n.nodeType === 9 ? n.head : n, t.insertBefore(e, t.firstChild));
	}
	function Hm(e, t) {
		e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.title ??= t.title;
	}
	function Um(e, t) {
		e.crossOrigin ??= t.crossOrigin, e.referrerPolicy ??= t.referrerPolicy, e.integrity ??= t.integrity;
	}
	var Wm = null;
	function Gm(e, t, n) {
		if (Wm === null) {
			var r = /* @__PURE__ */ new Map(), i = Wm = /* @__PURE__ */ new Map();
			i.set(n, r);
		} else i = Wm, r = i.get(n), r || (r = /* @__PURE__ */ new Map(), i.set(n, r));
		if (r.has(e)) return r;
		for (r.set(e, null), n = n.getElementsByTagName(e), i = 0; i < n.length; i++) {
			var a = n[i];
			if (!(a[Nt] || a[Et] || e === "link" && a.getAttribute("rel") === "stylesheet") && a.namespaceURI !== "http://www.w3.org/2000/svg") {
				var o = a.getAttribute(t) || "";
				o = e + o;
				var s = r.get(o);
				s ? s.push(a) : r.set(o, [a]);
			}
		}
		return r;
	}
	function Km(e, t, n) {
		e = e.ownerDocument || e, e.head.insertBefore(n, t === "title" ? e.querySelector("head > title") : null);
	}
	function qm(e, t, n) {
		if (n === 1 || t.itemProp != null) return !1;
		switch (e) {
			case "meta":
			case "title": return !0;
			case "style":
				if (typeof t.precedence != "string" || typeof t.href != "string" || t.href === "") break;
				return !0;
			case "link":
				if (typeof t.rel != "string" || typeof t.href != "string" || t.href === "" || t.onLoad || t.onError) break;
				switch (t.rel) {
					case "stylesheet": return e = t.disabled, typeof t.precedence == "string" && e == null;
					default: return !0;
				}
			case "script": if (t.async && typeof t.async != "function" && typeof t.async != "symbol" && !t.onLoad && !t.onError && t.src && typeof t.src == "string") return !0;
		}
		return !1;
	}
	function Jm(e, t) {
		return e === "img" && t.src != null && t.src !== "" && t.onLoad == null && t.loading !== "lazy";
	}
	function Ym(e) {
		return !(e.type === "stylesheet" && !(e.state.loading & 3));
	}
	function Xm(e) {
		return (e.width || 100) * (e.height || 100) * (typeof devicePixelRatio == "number" ? devicePixelRatio : 1) * .25;
	}
	function Zm(e, t) {
		typeof t.decode == "function" && (e.imgCount++, t.complete || (e.imgBytes += Xm(t), e.suspenseyImages.push(t)), e = rh.bind(e), t.decode().then(e, e));
	}
	function Qm(e, t, n, r) {
		if (n.type === "stylesheet" && (typeof r.media != "string" || !1 !== matchMedia(r.media).matches) && !(n.state.loading & 4)) {
			if (n.instance === null) {
				var i = Pm(r.href), a = t.querySelector(Fm(i));
				if (a) {
					t = a._p, typeof t == "object" && t && typeof t.then == "function" && (e.count++, e = nh.bind(e), t.then(e, e)), n.state.loading |= 4, n.instance = a, Bt(a);
					return;
				}
				a = t.ownerDocument || t, r = Im(r), (i = vm.get(i)) && Hm(r, i), a = a.createElement("link"), Bt(a);
				var o = a;
				o._p = new Promise(function(e, t) {
					o.onload = e, o.onerror = t;
				}), np(a, "link", r), n.instance = a;
			}
			e.stylesheets === null && (e.stylesheets = /* @__PURE__ */ new Map()), e.stylesheets.set(n, t), (t = n.state.preload) && !(n.state.loading & 3) && (e.count++, n = nh.bind(e), t.addEventListener("load", n), t.addEventListener("error", n));
		}
	}
	var $m = 0;
	function eh(e, t) {
		return e.stylesheets && e.count === 0 && ah(e, e.stylesheets), 0 < e.count || 0 < e.imgCount ? function(n) {
			var r = setTimeout(function() {
				if (e.stylesheets && ah(e, e.stylesheets), e.unsuspend) {
					var t = e.unsuspend;
					e.unsuspend = null, t();
				}
			}, 6e4 + t);
			0 < e.imgBytes && $m === 0 && ($m = 62500 * op());
			var i = setTimeout(function() {
				if (e.waitingForImages = !1, e.count === 0 && (e.stylesheets && ah(e, e.stylesheets), e.unsuspend)) {
					var t = e.unsuspend;
					e.unsuspend = null, t();
				}
			}, (e.imgBytes > $m ? 50 : 800) + t);
			return e.unsuspend = n, function() {
				e.unsuspend = null, clearTimeout(r), clearTimeout(i);
			};
		} : null;
	}
	function th(e) {
		if (e.count === 0 && (e.imgCount === 0 || !e.waitingForImages)) {
			if (e.stylesheets) ah(e, e.stylesheets);
			else if (e.unsuspend) {
				var t = e.unsuspend;
				e.unsuspend = null, t();
			}
		}
	}
	function nh() {
		this.count--, th(this);
	}
	function rh() {
		this.imgCount--, th(this);
	}
	var ih = null;
	function ah(e, t) {
		e.stylesheets = null, e.unsuspend !== null && (e.count++, ih = /* @__PURE__ */ new Map(), t.forEach(oh, e), ih = null, nh.call(e));
	}
	function oh(e, t) {
		if (!(t.state.loading & 4)) {
			var n = ih.get(e);
			if (n) var r = n.get(null);
			else {
				n = /* @__PURE__ */ new Map(), ih.set(e, n);
				for (var i = e.querySelectorAll("link[data-precedence],style[data-precedence]"), a = 0; a < i.length; a++) {
					var o = i[a];
					(o.nodeName === "LINK" || o.getAttribute("media") !== "not all") && (n.set(o.dataset.precedence, o), r = o);
				}
				r && n.set(null, r);
			}
			i = t.instance, o = i.getAttribute("data-precedence"), a = n.get(o) || r, a === r && n.set(null, i), n.set(o, i), this.count++, r = nh.bind(this), i.addEventListener("load", r), i.addEventListener("error", r), a ? a.parentNode.insertBefore(i, a.nextSibling) : (e = e.nodeType === 9 ? e.head : e, e.insertBefore(i, e.firstChild)), t.state.loading |= 4;
		}
	}
	var sh = {
		$$typeof: le,
		Provider: null,
		Consumer: null,
		_currentValue: O,
		_currentValue2: O,
		_threadCount: 0
	};
	function ch(e, t, n, r, i, a, o, s, c) {
		this.tag = 1, this.containerInfo = e, this.pingCache = this.current = this.pendingChildren = null, this.timeoutHandle = -1, this.callbackNode = this.next = this.pendingContext = this.context = this.cancelPendingCommit = null, this.callbackPriority = 0, this.expirationTimes = ht(-1), this.entangledLanes = this.shellSuspendCounter = this.errorRecoveryDisabledLanes = this.expiredLanes = this.warmLanes = this.pingedLanes = this.suspendedLanes = this.pendingLanes = 0, this.entanglements = ht(0), this.hiddenUpdates = ht(null), this.identifierPrefix = r, this.onUncaughtError = i, this.onCaughtError = a, this.onRecoverableError = o, this.pooledCache = null, this.pooledCacheLanes = 0, this.formState = c, this.transitionTypes = null, this.incompleteTransitions = /* @__PURE__ */ new Map();
	}
	function lh(e, t, n, r, i, a, o, s, c, l, u, d) {
		return e = new ch(e, t, n, o, c, l, u, d, s), t = 1, !0 === a && (t |= 24), a = Ai(3, null, null, t), e.current = a, a.stateNode = e, t = ka(), t.refCount++, e.pooledCache = t, t.refCount++, a.memoizedState = {
			element: r,
			isDehydrated: n,
			cache: t
		}, fo(a), e;
	}
	function uh(e) {
		return e ? (e = Oi, e) : Oi;
	}
	function dh(e, t, n, r, i, a) {
		i = uh(i), r.context === null ? r.context = i : r.pendingContext = i, r = mo(t), r.payload = { element: n }, a = a === void 0 ? null : a, a !== null && (r.callback = a), n = ho(e, r, t), n !== null && (Pd(n, e, t), go(n, e, t));
	}
	function fh(e, t) {
		if (e = e.memoizedState, e !== null && e.dehydrated !== null) {
			var n = e.retryLane;
			e.retryLane = n !== 0 && n < t ? n : t;
		}
	}
	function ph(e, t) {
		fh(e, t), (e = e.alternate) && fh(e, t);
	}
	function mh(e) {
		if (e.tag === 13 || e.tag === 31) {
			var t = Ti(e, 67108864);
			t !== null && Pd(t, e, 67108864), ph(e, 67108864);
		}
	}
	function hh(e) {
		if (e.tag === 13 || e.tag === 31) {
			var t = jd();
			t = xt(t);
			var n = Ti(e, t);
			n !== null && Pd(n, e, t), ph(e, t);
		}
	}
	var gh = !0;
	function _h(e, t, n, r) {
		var i = E.T;
		E.T = null;
		var a = D.p;
		try {
			D.p = 2, yh(e, t, n, r);
		} finally {
			D.p = a, E.T = i;
		}
	}
	function vh(e, t, n, r) {
		var i = E.T;
		E.T = null;
		var a = D.p;
		try {
			D.p = 8, yh(e, t, n, r);
		} finally {
			D.p = a, E.T = i;
		}
	}
	function yh(e, t, n, r) {
		if (gh) {
			var i = bh(r);
			if (i === null) Kf(e, t, r, xh, n), Mh(e, r);
			else if (Ph(i, e, t, n, r)) r.stopPropagation();
			else if (Mh(e, r), t & 4 && -1 < jh.indexOf(e)) {
				for (; i !== null;) {
					var a = Lt(i);
					if (a !== null) switch (a.tag) {
						case 3:
							if (a = a.stateNode, a.current.memoizedState.isDehydrated) {
								var o = lt(a.pendingLanes);
								if (o !== 0) {
									var s = a;
									for (s.pendingLanes |= 2, s.entangledLanes |= 2; o;) {
										var c = 1 << 31 - nt(o);
										s.entanglements[1] |= c, o &= ~c;
									}
									Ef(a), !(q & 6) && (gd = N() + 500, Df(0, !1));
								}
							}
							break;
						case 31:
						case 13: s = Ti(a, 2), s !== null && Pd(s, a, 2), zd(), ph(a, 2);
					}
					if (a = bh(r), a === null && Kf(e, t, r, xh, n), a === i) break;
					i = a;
				}
				i !== null && r.stopPropagation();
			} else Kf(e, t, r, null, n);
		}
	}
	function bh(e) {
		return e = z(e), Sh(e);
	}
	var xh = null;
	function Sh(e) {
		if (xh = null, e = It(e), e !== null) {
			var t = o(e);
			if (t === null) e = null;
			else {
				var n = t.tag;
				if (n === 13) {
					if (e = s(t), e !== null) return e;
					e = null;
				} else if (n === 31) {
					if (e = c(t), e !== null) return e;
					e = null;
				} else if (n === 3) {
					if (t.stateNode.current.memoizedState.isDehydrated) return t.tag === 3 ? t.stateNode.containerInfo : null;
					e = null;
				} else t !== e && (e = null);
			}
		}
		return xh = e, null;
	}
	function Ch(e) {
		switch (e) {
			case "beforetoggle":
			case "cancel":
			case "click":
			case "close":
			case "contextmenu":
			case "copy":
			case "cut":
			case "auxclick":
			case "dblclick":
			case "dragend":
			case "dragstart":
			case "drop":
			case "focusin":
			case "focusout":
			case "input":
			case "invalid":
			case "keydown":
			case "keypress":
			case "keyup":
			case "mousedown":
			case "mouseup":
			case "paste":
			case "pause":
			case "play":
			case "pointercancel":
			case "pointerdown":
			case "pointerup":
			case "ratechange":
			case "reset":
			case "seeked":
			case "submit":
			case "toggle":
			case "touchcancel":
			case "touchend":
			case "touchstart":
			case "volumechange":
			case "change":
			case "selectionchange":
			case "textInput":
			case "compositionstart":
			case "compositionend":
			case "compositionupdate":
			case "beforeblur":
			case "afterblur":
			case "beforeinput":
			case "blur":
			case "fullscreenchange":
			case "fullscreenerror":
			case "focus":
			case "hashchange":
			case "popstate":
			case "select":
			case "selectstart": return 2;
			case "drag":
			case "dragenter":
			case "dragexit":
			case "dragleave":
			case "dragover":
			case "mousemove":
			case "mouseout":
			case "mouseover":
			case "pointermove":
			case "pointerout":
			case "pointerover":
			case "resize":
			case "scroll":
			case "touchmove":
			case "wheel":
			case "mouseenter":
			case "mouseleave":
			case "pointerenter":
			case "pointerleave": return 8;
			case "message": switch (Ke()) {
				case qe: return 2;
				case Je: return 8;
				case Ye:
				case Xe: return 32;
				case Ze: return 268435456;
				default: return 32;
			}
			default: return 32;
		}
	}
	var wh = !1, Th = null, Eh = null, Dh = null, Oh = /* @__PURE__ */ new Map(), kh = /* @__PURE__ */ new Map(), Ah = [], jh = "mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset".split(" ");
	function Mh(e, t) {
		switch (e) {
			case "focusin":
			case "focusout":
				Th = null;
				break;
			case "dragenter":
			case "dragleave":
				Eh = null;
				break;
			case "mouseover":
			case "mouseout":
				Dh = null;
				break;
			case "pointerover":
			case "pointerout":
				Oh.delete(t.pointerId);
				break;
			case "gotpointercapture":
			case "lostpointercapture": kh.delete(t.pointerId);
		}
	}
	function Nh(e, t, n, r, i, a) {
		return e === null || e.nativeEvent !== a ? (e = {
			blockedOn: t,
			domEventName: n,
			eventSystemFlags: r,
			nativeEvent: a,
			targetContainers: [i]
		}, t !== null && (t = Lt(t), t !== null && mh(t)), e) : (e.eventSystemFlags |= r, t = e.targetContainers, i !== null && t.indexOf(i) === -1 && t.push(i), e);
	}
	function Ph(e, t, n, r, i) {
		switch (t) {
			case "focusin": return Th = Nh(Th, e, t, n, r, i), !0;
			case "dragenter": return Eh = Nh(Eh, e, t, n, r, i), !0;
			case "mouseover": return Dh = Nh(Dh, e, t, n, r, i), !0;
			case "pointerover":
				var a = i.pointerId;
				return Oh.set(a, Nh(Oh.get(a) || null, e, t, n, r, i)), !0;
			case "gotpointercapture": return a = i.pointerId, kh.set(a, Nh(kh.get(a) || null, e, t, n, r, i)), !0;
		}
		return !1;
	}
	function Fh(e) {
		var t = It(e.target);
		if (t !== null) {
			var n = o(t);
			if (n !== null) {
				if (t = n.tag, t === 13) {
					if (t = s(n), t !== null) {
						e.blockedOn = t, wt(e.priority, function() {
							hh(n);
						});
						return;
					}
				} else if (t === 31) {
					if (t = c(n), t !== null) {
						e.blockedOn = t, wt(e.priority, function() {
							hh(n);
						});
						return;
					}
				} else if (t === 3 && n.stateNode.current.memoizedState.isDehydrated) {
					e.blockedOn = n.tag === 3 ? n.stateNode.containerInfo : null;
					return;
				}
			}
		}
		e.blockedOn = null;
	}
	function Ih(e) {
		if (e.blockedOn !== null) return !1;
		for (var t = e.targetContainers; 0 < t.length;) {
			var n = bh(e.nativeEvent);
			if (n === null) {
				n = e.nativeEvent;
				var r = new n.constructor(n.type, n);
				bn = r, n.target.dispatchEvent(r), bn = null;
			} else return t = Lt(n), t !== null && mh(t), e.blockedOn = n, !1;
			t.shift();
		}
		return !0;
	}
	function Lh(e, t, n) {
		Ih(e) && n.delete(t);
	}
	function Rh() {
		wh = !1, Th !== null && Ih(Th) && (Th = null), Eh !== null && Ih(Eh) && (Eh = null), Dh !== null && Ih(Dh) && (Dh = null), Oh.forEach(Lh), kh.forEach(Lh);
	}
	function zh(e, n) {
		e.blockedOn === n && (e.blockedOn = null, wh || (wh = !0, t.unstable_scheduleCallback(t.unstable_NormalPriority, Rh)));
	}
	var Bh = null;
	function Vh(e) {
		Bh !== e && (Bh = e, t.unstable_scheduleCallback(t.unstable_NormalPriority, function() {
			Bh === e && (Bh = null);
			for (var t = 0; t < e.length; t += 3) {
				var n = e[t], r = e[t + 1], i = e[t + 2];
				if (typeof r != "function") {
					if (Sh(r || n) === null) continue;
					break;
				}
				var a = Lt(n);
				a !== null && (e.splice(t, 3), t -= 3, Qs(a, {
					pending: !0,
					data: i,
					method: n.method,
					action: r
				}, r, i));
			}
		}));
	}
	function Hh(e) {
		function t(t) {
			return zh(t, e);
		}
		Th !== null && zh(Th, e), Eh !== null && zh(Eh, e), Dh !== null && zh(Dh, e), Oh.forEach(t), kh.forEach(t);
		for (var n = 0; n < Ah.length; n++) {
			var r = Ah[n];
			r.blockedOn === e && (r.blockedOn = null);
		}
		for (; 0 < Ah.length && (n = Ah[0], n.blockedOn === null);) Fh(n), n.blockedOn === null && Ah.shift();
		if (n = (e.ownerDocument || e).$$reactFormReplay, n != null) for (r = 0; r < n.length; r += 3) {
			var i = n[r], a = n[r + 1], o = i[Dt] || null;
			if (typeof a == "function") o || Vh(n);
			else if (o) {
				var s = null;
				if (a && a.hasAttribute("formAction")) {
					if (i = a, o = a[Dt] || null) s = o.formAction;
					else if (Sh(i) !== null) continue;
				} else s = o.action;
				typeof s == "function" ? n[r + 1] = s : (n.splice(r, 3), r -= 3), Vh(n);
			}
		}
	}
	function Uh() {
		function e(e) {
			e.canIntercept && e.info === "react-transition" && e.intercept({
				handler: function() {
					return new Promise(function(e) {
						return i = e;
					});
				},
				focusReset: "manual",
				scroll: "manual"
			});
		}
		function t() {
			i !== null && (i(), i = null), r || setTimeout(n, 20);
		}
		function n() {
			if (!r && !navigation.transition) {
				var e = navigation.currentEntry;
				e && e.url != null && navigation.navigate(e.url, {
					state: e.getState(),
					info: "react-transition",
					history: "replace"
				});
			}
		}
		if (typeof navigation == "object") {
			var r = !1, i = null;
			return navigation.addEventListener("navigate", e), navigation.addEventListener("navigatesuccess", t), navigation.addEventListener("navigateerror", t), setTimeout(n, 100), function() {
				r = !0, navigation.removeEventListener("navigate", e), navigation.removeEventListener("navigatesuccess", t), navigation.removeEventListener("navigateerror", t), i !== null && (i(), i = null);
			};
		}
	}
	function Wh(e) {
		this._internalRoot = e;
	}
	Gh.prototype.render = Wh.prototype.render = function(e) {
		var t = this._internalRoot;
		if (t === null) throw Error(i(409));
		var n = t.current;
		dh(n, jd(), e, t, null, null);
	}, Gh.prototype.unmount = Wh.prototype.unmount = function() {
		var e = this._internalRoot;
		if (e !== null) {
			this._internalRoot = null;
			var t = e.containerInfo;
			dh(e.current, 2, null, e, null, null), zd(), t[Ot] = null;
		}
	};
	function Gh(e) {
		this._internalRoot = e;
	}
	Gh.prototype.unstable_scheduleHydration = function(e) {
		if (e) {
			var t = Ct();
			e = {
				blockedOn: null,
				target: e,
				priority: t
			};
			for (var n = 0; n < Ah.length && t !== 0 && t < Ah[n].priority; n++);
			Ah.splice(n, 0, e), n === 0 && Fh(e);
		}
	};
	var Kh = n.version;
	if (Kh !== "19.3.1") throw Error(i(527, Kh, "19.3.1"));
	D.findDOMNode = function(e) {
		var t = e._reactInternals;
		if (t === void 0) throw typeof e.render == "function" ? Error(i(188)) : (e = Object.keys(e).join(","), Error(i(268, e)));
		return e = d(t), e = e === null ? null : p(e), e = e === null ? null : e.stateNode, e;
	};
	var qh = {
		bundleType: 0,
		version: "19.3.1",
		rendererPackageName: "react-dom",
		currentDispatcherRef: E,
		reconcilerVersion: "19.3.1"
	};
	if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u") {
		var Jh = __REACT_DEVTOOLS_GLOBAL_HOOK__;
		if (!Jh.isDisabled && Jh.supportsFiber) try {
			et = Jh.inject(qh), P = Jh;
		} catch {}
	}
	e.createRoot = function(e, t) {
		if (!a(e)) throw Error(i(299));
		var n = !1, r = "", o = xc, s = Sc, c = Cc;
		return t != null && (!0 === t.unstable_strictMode && (n = !0), t.identifierPrefix !== void 0 && (r = t.identifierPrefix), t.onUncaughtError !== void 0 && (o = t.onUncaughtError), t.onCaughtError !== void 0 && (s = t.onCaughtError), t.onRecoverableError !== void 0 && (c = t.onRecoverableError)), t = lh(e, 1, !1, null, null, n, r, null, o, s, c, Uh), e[Ot] = t.current, Wf(e), new Wh(t);
	};
})), g = /* @__PURE__ */ o(((e, t) => {
	function n() {
		if (typeof __REACT_DEVTOOLS_GLOBAL_HOOK__ < "u" && typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE == "function") try {
			__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(n);
		} catch (e) {
			console.error(e);
		}
	}
	n(), t.exports = h();
})), _ = /* @__PURE__ */ c(u(), 1), v = globalThis?.document ? _.useLayoutEffect : () => {}, y = Object.defineProperty, b = (e, t) => y(e, "name", {
	value: t,
	configurable: !0
}), x = _.useInsertionEffect;
function S(e) {
	let t = _.useRef(e);
	return typeof x == "function" ? x(() => {
		t.current = e;
	}) : v(() => {
		t.current = e;
	}), _.useMemo(() => ((...e) => t.current?.(...e)), []);
}
b(S, "useCallbackRef");
// node_modules/@montage-ui/core/dist/components/animation-presence/hooks.mjs
var C = (e) => (0, _.useReducer)((e, t) => {
	switch (t) {
		case "UNMOUNT": return e === "mounted" ? "unmounted" : e;
		case "MOUNT": return "mounted";
		case "ANIMATION_START": return e === "mounted" ? "unmountTriggered" : e;
		case "ANIMATION_END": return e === "unmountTriggered" ? "unmounted" : e;
		default: return e;
	}
}, e), ee = globalThis?.document ? _.useLayoutEffect : () => {}, w = (e, t) => {
	let [n, r] = (0, _.useState)(null), [i, a] = C(e ? "mounted" : "unmounted"), o = S(t?.filter ?? (() => !0));
	return ee(() => {
		if (e) {
			a("MOUNT");
			return;
		}
		if (!n) return;
		let r = [], i = n.getAnimations(t).filter(({ effect: e }) => e && "target" in e && e.target ? o(e.target) : !1);
		if (i.length === 0) {
			a("UNMOUNT");
			return;
		}
		a("ANIMATION_START");
		let s = () => {
			i.some((e) => e.playState === "running") || a("ANIMATION_END");
		};
		return i.forEach((e) => {
			let t = e.effect?.getTiming().fill;
			e.effect?.updateTiming({ fill: "forwards" });
			let n = () => s(), i = () => s();
			e.addEventListener("finish", n), e.addEventListener("cancel", i), r.push(() => {
				e.removeEventListener("finish", n), e.removeEventListener("cancel", i), e.effect?.updateTiming({ fill: t });
			});
		}), () => {
			r.forEach((e) => e()), r = [];
		};
	}, [e, n]), {
		isPresent: e || i !== "unmounted",
		ref: r
	};
}, te = Object.defineProperty, T = (e, t) => te(e, "name", {
	value: t,
	configurable: !0
});
function ne(e, t) {
	if (typeof e == "function") return e(t);
	e != null && (e.current = t);
}
T(ne, "setRef");
function re(...e) {
	return (t) => {
		let n = !1, r = e.map((e) => {
			let r = ne(e, t);
			return !n && typeof r == "function" && (n = !0), r;
		});
		if (n) return () => {
			for (let t = 0; t < r.length; t++) {
				let n = r[t];
				typeof n == "function" ? n() : ne(e[t], null);
			}
		};
	};
}
T(re, "composeRefs");
function ie(...e) {
	return _.useCallback(re(...e), e);
}
T(ie, "useComposedRefs");
// node_modules/@radix-ui/react-slot/dist/index.mjs
var ae = Object.defineProperty, oe = (e, t) => ae(e, "name", {
	value: t,
	configurable: !0
});
// @__NO_SIDE_EFFECTS__
function se(e) {
	let t = _.forwardRef((t, n) => {
		let { children: r, ...i } = t, a = null, o = !1, s = [];
		r = ye(r), _.Children.forEach(r, (e) => {
			if (he(e)) {
				o = !0;
				let t = e, n = "child" in t.props ? t.props.child : t.props.children;
				for (; _e(n) && typeof Ce == "function";) n = Ce(n._payload);
				a = fe(t, n), s.push(a?.props?.children);
			} else s.push(e);
		}), a ? a = _.cloneElement(a, void 0, s) : !o && _.Children.count(r) === 1 && _.isValidElement(r) && (a = r);
		let c = a ? me(a) : void 0, l = ie(n, c);
		if (!a) {
			if (r || r === 0) throw Error(o ? Se(e) : xe(e));
			return r;
		}
		let u = pe(i, a.props ?? {});
		return a.type !== _.Fragment && (u.ref = n ? l : c), _.cloneElement(a, u);
	});
	return t.displayName = `${e}.Slot`, t;
}
oe(se, "createSlot");
var ce = /* @__PURE__ */ se("Slot"), le = Symbol.for("radix.slottable");
// @__NO_SIDE_EFFECTS__
function ue(e) {
	let t = /* @__PURE__ */ oe((e) => "child" in e ? e.children(e.child) : e.children, "Slottable");
	return t.displayName = `${e}.Slottable`, t.__radixId = le, t;
}
oe(ue, "createSlottable");
var de = /* @__PURE__ */ ue("Slottable"), fe = /* @__PURE__ */ oe((e, t) => "child" in e.props ? _.isValidElement(t) ? _.cloneElement(t, void 0, e.props.children(t.props.children)) : null : _.isValidElement(t) ? t : null, "getSlottableElementFromSlottable");
function pe(e, t) {
	let n = { ...t };
	for (let r in t) {
		let i = e[r], a = t[r];
		/^on[A-Z]/.test(r) ? i && a ? n[r] = (...e) => {
			let t = a(...e);
			return i(...e), t;
		} : i && (n[r] = i) : r === "style" ? n[r] = {
			...i,
			...a
		} : r === "className" ? n[r] = [i, a].filter(Boolean).join(" ") : r === "aria-describedby" && (n[r] = be(a, i));
	}
	return {
		...e,
		...n
	};
}
oe(pe, "mergeProps");
function me(e) {
	let t = Object.getOwnPropertyDescriptor(e.props, "ref")?.get, n = t && "isReactWarning" in t && t.isReactWarning;
	return n ? e.ref : (t = Object.getOwnPropertyDescriptor(e, "ref")?.get, n = t && "isReactWarning" in t && t.isReactWarning, n ? e.props.ref : e.props.ref || e.ref);
}
oe(me, "getElementRef");
function he(e) {
	return _.isValidElement(e) && typeof e.type == "function" && "__radixId" in e.type && e.type.__radixId === le;
}
oe(he, "isSlottable");
var ge = Symbol.for("react.lazy");
function _e(e) {
	return typeof e == "object" && !!e && "$$typeof" in e && e.$$typeof === ge && "_payload" in e && ve(e._payload);
}
oe(_e, "isLazyComponent");
function ve(e) {
	return typeof e == "object" && !!e && "then" in e;
}
oe(ve, "isPromiseLike");
function ye(e) {
	let t = e;
	for (; _e(t) && typeof Ce == "function";) t = Ce(t._payload);
	return t;
}
oe(ye, "useUnwrappedLazy");
function be(...e) {
	let t = /* @__PURE__ */ new Set();
	for (let n of e) if (typeof n == "string") for (let e of String(n).trim().split(/\s+/)) e && t.add(e);
	return t.size > 0 ? Array.from(t).join(" ") : void 0;
}
oe(be, "concatAriaDescribedby");
var xe = /* @__PURE__ */ oe((e) => `${e} failed to slot onto its children. Expected a single React element child or \`Slottable\`.`, "createSlotError"), Se = /* @__PURE__ */ oe((e) => `${e} failed to slot onto its \`Slottable\`. Expected \`Slottable\` to receive a single React element child.`, "createSlottableError"), Ce = _.use, we = /* @__PURE__ */ o(((e) => {
	var t = Symbol.for("react.transitional.element"), n = Symbol.for("react.fragment");
	function r(e, n, r) {
		var i = null;
		if (r !== void 0 && (i = "" + r), n.key !== void 0 && (i = "" + n.key), "key" in n) for (var a in r = {}, n) a !== "key" && (r[a] = n[a]);
		else r = n;
		return n = r.ref, {
			$$typeof: t,
			type: e,
			key: i,
			ref: n === void 0 ? null : n,
			props: r
		};
	}
	e.Fragment = n, e.jsx = r, e.jsxs = r;
})), E = /* @__PURE__ */ o(((e, t) => {
	t.exports = we();
})), D = /* @__PURE__ */ c(m(), 1), O = /* @__PURE__ */ c(E(), 1), Te = (0, _.forwardRef)(({ present: e = !1, children: t, options: n }, r) => {
	let { isPresent: i, ref: a } = w(e, n), o = ie(r, a);
	return i ? /* @__PURE__ */ (0, O.jsx)(ce, {
		ref: o,
		children: t
	}) : null;
});
Te.displayName = "AnimationPresence";
// node_modules/@montage-ui/core/dist/utils/media.mjs
var Ee = (e) => `@media only screen and (max-width: ${parseInt(e, 10) - 1}px)`, De = (e) => `@media only screen and (min-width: ${e})`, k = (e) => typeof e == "number" ? `${e}px` : e, A = (e, t) => Array.isArray(e) ? e.map((e) => A(e, t)) : typeof e == "function" ? e(t) : e;
// node_modules/@emotion/sheet/dist/emotion-sheet.esm.js
function Oe(e) {
	if (e.sheet) return e.sheet;
	/* istanbul ignore next */
	for (var t = 0; t < document.styleSheets.length; t++) if (document.styleSheets[t].ownerNode === e) return document.styleSheets[t];
}
function ke(e) {
	var t = document.createElement("style");
	return t.setAttribute("data-emotion", e.key), e.nonce !== void 0 && t.setAttribute("nonce", e.nonce), t.appendChild(document.createTextNode("")), t.setAttribute("data-s", ""), t;
}
var Ae = /*#__PURE__*/ function() {
	function e(e) {
		var t = this;
		this._insertTag = function(e) {
			var n = t.tags.length === 0 ? t.insertionPoint ? t.insertionPoint.nextSibling : t.prepend ? t.container.firstChild : t.before : t.tags[t.tags.length - 1].nextSibling;
			t.container.insertBefore(e, n), t.tags.push(e);
		}, this.isSpeedy = e.speedy === void 0 || e.speedy, this.tags = [], this.ctr = 0, this.nonce = e.nonce, this.key = e.key, this.container = e.container, this.prepend = e.prepend, this.insertionPoint = e.insertionPoint, this.before = null;
	}
	var t = e.prototype;
	return t.hydrate = function(e) {
		e.forEach(this._insertTag);
	}, t.insert = function(e) {
		this.ctr % (this.isSpeedy ? 65e3 : 1) == 0 && this._insertTag(ke(this));
		var t = this.tags[this.tags.length - 1];
		if (this.isSpeedy) {
			var n = Oe(t);
			try {
				n.insertRule(e, n.cssRules.length);
			} catch {}
		} else t.appendChild(document.createTextNode(e));
		this.ctr++;
	}, t.flush = function() {
		this.tags.forEach(function(e) {
			return e.parentNode?.removeChild(e);
		}), this.tags = [], this.ctr = 0;
	}, e;
}(), je = "-ms-", Me = "-moz-", j = "-webkit-", Ne = "comm", Pe = "rule", Fe = "decl", Ie = "@import", Le = "@keyframes", Re = "@layer", ze = Math.abs, Be = String.fromCharCode, Ve = Object.assign;
function He(e, t) {
	return N(e, 0) ^ 45 ? (((t << 2 ^ N(e, 0)) << 2 ^ N(e, 1)) << 2 ^ N(e, 2)) << 2 ^ N(e, 3) : 0;
}
function Ue(e) {
	return e.trim();
}
function We(e, t) {
	return (e = t.exec(e)) ? e[0] : e;
}
function M(e, t, n) {
	return e.replace(t, n);
}
function Ge(e, t) {
	return e.indexOf(t);
}
function N(e, t) {
	return e.charCodeAt(t) | 0;
}
function Ke(e, t, n) {
	return e.slice(t, n);
}
function qe(e) {
	return e.length;
}
function Je(e) {
	return e.length;
}
function Ye(e, t) {
	return t.push(e), e;
}
function Xe(e, t) {
	return e.map(t).join("");
}
// node_modules/stylis/src/Tokenizer.js
var Ze = 1, Qe = 1, $e = 0, et = 0, P = 0, tt = "";
function nt(e, t, n, r, i, a, o) {
	return {
		value: e,
		root: t,
		parent: n,
		type: r,
		props: i,
		children: a,
		line: Ze,
		column: Qe,
		length: o,
		return: ""
	};
}
function rt(e, t) {
	return Ve(nt("", null, null, "", null, null, 0), e, { length: -e.length }, t);
}
function it() {
	return P;
}
function at() {
	return P = et > 0 ? N(tt, --et) : 0, Qe--, P === 10 && (Qe = 1, Ze--), P;
}
function ot() {
	return P = et < $e ? N(tt, et++) : 0, Qe++, P === 10 && (Qe = 1, Ze++), P;
}
function st() {
	return N(tt, et);
}
function ct() {
	return et;
}
function lt(e, t) {
	return Ke(tt, e, t);
}
function ut(e) {
	switch (e) {
		case 0:
		case 9:
		case 10:
		case 13:
		case 32: return 5;
		case 33:
		case 43:
		case 44:
		case 47:
		case 62:
		case 64:
		case 126:
		case 59:
		case 123:
		case 125: return 4;
		case 58: return 3;
		case 34:
		case 39:
		case 40:
		case 91: return 2;
		case 41:
		case 93: return 1;
	}
	return 0;
}
function dt(e) {
	return Ze = Qe = 1, $e = qe(tt = e), et = 0, [];
}
function ft(e) {
	return tt = "", e;
}
function pt(e) {
	return Ue(lt(et - 1, gt(e === 91 ? e + 2 : e === 40 ? e + 1 : e)));
}
function mt(e) {
	for (; (P = st()) && P < 33;) ot();
	return ut(e) > 2 || ut(P) > 3 ? "" : " ";
}
function ht(e, t) {
	for (; --t && ot() && !(P < 48 || P > 102 || P > 57 && P < 65 || P > 70 && P < 97););
	return lt(e, ct() + (t < 6 && st() == 32 && ot() == 32));
}
function gt(e) {
	for (; ot();) switch (P) {
		case e: return et;
		case 34:
		case 39:
			e !== 34 && e !== 39 && gt(P);
			break;
		case 40:
			e === 41 && gt(e);
			break;
		case 92: ot();
	}
	return et;
}
function _t(e, t) {
	for (; ot() && e + P !== 57 && (e + P !== 84 || st() !== 47););
	return "/*" + lt(t, et - 1) + "*" + Be(e === 47 ? e : ot());
}
function vt(e) {
	for (; !ut(st());) ot();
	return lt(e, et);
}
// node_modules/stylis/src/Parser.js
function yt(e) {
	return ft(bt("", null, null, null, [""], e = dt(e), 0, [0], e));
}
function bt(e, t, n, r, i, a, o, s, c) {
	for (var l = 0, u = 0, d = o, f = 0, p = 0, m = 0, h = 1, g = 1, _ = 1, v = 0, y = "", b = i, x = a, S = r, C = y; g;) switch (m = v, v = ot()) {
		case 40: if (m != 108 && N(C, d - 1) == 58) {
			Ge(C += M(pt(v), "&", "&\f"), "&\f") != -1 && (_ = -1);
			break;
		}
		case 34:
		case 39:
		case 91:
			C += pt(v);
			break;
		case 9:
		case 10:
		case 13:
		case 32:
			C += mt(m);
			break;
		case 92:
			C += ht(ct() - 1, 7);
			continue;
		case 47:
			switch (st()) {
				case 42:
				case 47:
					Ye(St(_t(ot(), ct()), t, n), c);
					break;
				default: C += "/";
			}
			break;
		case 123 * h: s[l++] = qe(C) * _;
		case 125 * h:
		case 59:
		case 0:
			switch (v) {
				case 0:
				case 125: g = 0;
				case 59 + u:
					_ == -1 && (C = M(C, /\f/g, "")), p > 0 && qe(C) - d && Ye(p > 32 ? Ct(C + ";", r, n, d - 1) : Ct(M(C, " ", "") + ";", r, n, d - 2), c);
					break;
				case 59: C += ";";
				default: if (Ye(S = xt(C, t, n, l, u, i, s, y, b = [], x = [], d), a), v === 123) {
					if (u === 0) bt(C, t, S, S, b, a, d, s, x);
					else switch (f === 99 && N(C, 3) === 110 ? 100 : f) {
						case 100:
						case 108:
						case 109:
						case 115:
							bt(e, S, S, r && Ye(xt(e, S, S, 0, 0, i, s, y, i, b = [], d), x), i, x, d, s, r ? b : x);
							break;
						default: bt(C, S, S, S, [""], x, 0, s, x);
					}
				}
			}
			l = u = p = 0, h = _ = 1, y = C = "", d = o;
			break;
		case 58: d = 1 + qe(C), p = m;
		default:
			if (h < 1) {
				if (v == 123) --h;
				else if (v == 125 && h++ == 0 && at() == 125) continue;
			}
			switch (C += Be(v), v * h) {
				case 38:
					_ = u > 0 ? 1 : (C += "\f", -1);
					break;
				case 44:
					s[l++] = (qe(C) - 1) * _, _ = 1;
					break;
				case 64:
					st() === 45 && (C += pt(ot())), f = st(), u = d = qe(y = C += vt(ct())), v++;
					break;
				case 45: m === 45 && qe(C) == 2 && (h = 0);
			}
	}
	return a;
}
function xt(e, t, n, r, i, a, o, s, c, l, u) {
	for (var d = i - 1, f = i === 0 ? a : [""], p = Je(f), m = 0, h = 0, g = 0; m < r; ++m) for (var _ = 0, v = Ke(e, d + 1, d = ze(h = o[m])), y = e; _ < p; ++_) (y = Ue(h > 0 ? f[_] + " " + v : M(v, /&\f/g, f[_]))) && (c[g++] = y);
	return nt(e, t, n, i === 0 ? Pe : s, c, l, u);
}
function St(e, t, n) {
	return nt(e, t, n, Ne, Be(it()), Ke(e, 2, -2), 0);
}
function Ct(e, t, n, r) {
	return nt(e, t, n, Fe, Ke(e, 0, r), Ke(e, r + 1, -1), r);
}
// node_modules/stylis/src/Serializer.js
function wt(e, t) {
	for (var n = "", r = Je(e), i = 0; i < r; i++) n += t(e[i], i, e, t) || "";
	return n;
}
function Tt(e, t, n, r) {
	switch (e.type) {
		case Re: if (e.children.length) break;
		case Ie:
		case Fe: return e.return = e.return || e.value;
		case Ne: return "";
		case Le: return e.return = e.value + "{" + wt(e.children, r) + "}";
		case Pe: e.value = e.props.join(",");
	}
	return qe(n = wt(e.children, r)) ? e.return = e.value + "{" + n + "}" : "";
}
// node_modules/stylis/src/Middleware.js
function Et(e) {
	var t = Je(e);
	return function(n, r, i, a) {
		for (var o = "", s = 0; s < t; s++) o += e[s](n, r, i, a) || "";
		return o;
	};
}
function Dt(e) {
	return function(t) {
		t.root || (t = t.return) && e(t);
	};
}
// node_modules/@emotion/memoize/dist/emotion-memoize.esm.js
function Ot(e) {
	var t = Object.create(null);
	return function(n) {
		return t[n] === void 0 && (t[n] = e(n)), t[n];
	};
}
// node_modules/@emotion/cache/dist/emotion-cache.browser.esm.js
var kt = function(e, t, n) {
	for (var r = 0, i = 0; r = i, i = st(), r === 38 && i === 12 && (t[n] = 1), !ut(i);) ot();
	return lt(e, et);
}, At = function(e, t) {
	var n = -1, r = 44;
	do
		switch (ut(r)) {
			case 0:
				r === 38 && st() === 12 && (t[n] = 1), e[n] += kt(et - 1, t, n);
				break;
			case 2:
				e[n] += pt(r);
				break;
			case 4: if (r === 44) {
				e[++n] = st() === 58 ? "&\f" : "", t[n] = e[n].length;
				break;
			}
			default: e[n] += Be(r);
		}
	while (r = ot());
	return e;
}, jt = function(e, t) {
	return ft(At(dt(e), t));
}, Mt = /* #__PURE__ */ new WeakMap(), Nt = function(e) {
	if (!(e.type !== "rule" || !e.parent || e.length < 1)) {
		for (var t = e.value, n = e.parent, r = e.column === n.column && e.line === n.line; n.type !== "rule";) if (n = n.parent, !n) return;
		if ((e.props.length !== 1 || t.charCodeAt(0) === 58 || Mt.get(n)) && !r) {
			Mt.set(e, !0);
			for (var i = [], a = jt(t, i), o = n.props, s = 0, c = 0; s < a.length; s++) for (var l = 0; l < o.length; l++, c++) e.props[c] = i[s] ? a[s].replace(/&\f/g, o[l]) : o[l] + " " + a[s];
		}
	}
}, Pt = function(e) {
	if (e.type === "decl") {
		var t = e.value;
		t.charCodeAt(0) === 108 && t.charCodeAt(2) === 98 && (e.return = "", e.value = "");
	}
};
function Ft(e, t) {
	switch (He(e, t)) {
		case 5103: return j + "print-" + e + e;
		case 5737:
		case 4201:
		case 3177:
		case 3433:
		case 1641:
		case 4457:
		case 2921:
		case 5572:
		case 6356:
		case 5844:
		case 3191:
		case 6645:
		case 3005:
		case 6391:
		case 5879:
		case 5623:
		case 6135:
		case 4599:
		case 4855:
		case 4215:
		case 6389:
		case 5109:
		case 5365:
		case 5621:
		case 3829: return j + e + e;
		case 5349:
		case 4246:
		case 4810:
		case 6968:
		case 2756: return j + e + Me + e + je + e + e;
		case 6828:
		case 4268: return j + e + je + e + e;
		case 6165: return j + e + je + "flex-" + e + e;
		case 5187: return j + e + M(e, /(\w+).+(:[^]+)/, j + "box-$1$2" + je + "flex-$1$2") + e;
		case 5443: return j + e + je + "flex-item-" + M(e, /flex-|-self/, "") + e;
		case 4675: return j + e + je + "flex-line-pack" + M(e, /align-content|flex-|-self/, "") + e;
		case 5548: return j + e + je + M(e, "shrink", "negative") + e;
		case 5292: return j + e + je + M(e, "basis", "preferred-size") + e;
		case 6060: return j + "box-" + M(e, "-grow", "") + j + e + je + M(e, "grow", "positive") + e;
		case 4554: return j + M(e, /([^-])(transform)/g, "$1" + j + "$2") + e;
		case 6187: return M(M(M(e, /(zoom-|grab)/, j + "$1"), /(image-set)/, j + "$1"), e, "") + e;
		case 5495:
		case 3959: return M(e, /(image-set\([^]*)/, j + "$1$`$1");
		case 4968: return M(M(e, /(.+:)(flex-)?(.*)/, j + "box-pack:$3" + je + "flex-pack:$3"), /s.+-b[^;]+/, "justify") + j + e + e;
		case 4095:
		case 3583:
		case 4068:
		case 2532: return M(e, /(.+)-inline(.+)/, j + "$1$2") + e;
		case 8116:
		case 7059:
		case 5753:
		case 5535:
		case 5445:
		case 5701:
		case 4933:
		case 4677:
		case 5533:
		case 5789:
		case 5021:
		case 4765:
			if (qe(e) - 1 - t > 6) switch (N(e, t + 1)) {
				case 109: if (N(e, t + 4) !== 45) break;
				case 102: return M(e, /(.+:)(.+)-([^]+)/, "$1" + j + "$2-$3$1" + Me + (N(e, t + 3) == 108 ? "$3" : "$2-$3")) + e;
				case 115: return ~Ge(e, "stretch") ? Ft(M(e, "stretch", "fill-available"), t) + e : e;
			}
			break;
		case 4949: if (N(e, t + 1) !== 115) break;
		case 6444:
			switch (N(e, qe(e) - 3 - (~Ge(e, "!important") && 10))) {
				case 107: return M(e, ":", ":" + j) + e;
				case 101: return M(e, /(.+:)([^;!]+)(;|!.+)?/, "$1" + j + (N(e, 14) === 45 ? "inline-" : "") + "box$3$1" + j + "$2$3$1" + je + "$2box$3") + e;
			}
			break;
		case 5936:
			switch (N(e, t + 11)) {
				case 114: return j + e + je + M(e, /[svh]\w+-[tblr]{2}/, "tb") + e;
				case 108: return j + e + je + M(e, /[svh]\w+-[tblr]{2}/, "tb-rl") + e;
				case 45: return j + e + je + M(e, /[svh]\w+-[tblr]{2}/, "lr") + e;
			}
			return j + e + je + e + e;
	}
	return e;
}
var It = [function(e, t, n, r) {
	if (e.length > -1 && !e.return) switch (e.type) {
		case Fe:
			e.return = Ft(e.value, e.length);
			break;
		case Le: return wt([rt(e, { value: M(e.value, "@", "@" + j) })], r);
		case Pe: if (e.length) return Xe(e.props, function(t) {
			switch (We(t, /(::plac\w+|:read-\w+)/)) {
				case ":read-only":
				case ":read-write": return wt([rt(e, { props: [M(t, /:(read-\w+)/, ":" + Me + "$1")] })], r);
				case "::placeholder": return wt([
					rt(e, { props: [M(t, /:(plac\w+)/, ":" + j + "input-$1")] }),
					rt(e, { props: [M(t, /:(plac\w+)/, ":" + Me + "$1")] }),
					rt(e, { props: [M(t, /:(plac\w+)/, je + "input-$1")] })
				], r);
			}
			return "";
		});
	}
}], Lt = function(e) {
	var t = e.key;
	if (t === "css") {
		var n = document.querySelectorAll("style[data-emotion]:not([data-s])");
		Array.prototype.forEach.call(n, function(e) {
			e.getAttribute("data-emotion").indexOf(" ") !== -1 && (document.head.appendChild(e), e.setAttribute("data-s", ""));
		});
	}
	var r = e.stylisPlugins || It, i = {}, a, o = [];
	a = e.container || document.head, Array.prototype.forEach.call(document.querySelectorAll("style[data-emotion^=\"" + t + " \"]"), function(e) {
		for (var t = e.getAttribute("data-emotion").split(" "), n = 1; n < t.length; n++) i[t[n]] = !0;
		o.push(e);
	});
	var s, c = [Nt, Pt], l, u = [Tt, Dt(function(e) {
		l.insert(e);
	})], d = Et(c.concat(r, u)), f = function(e) {
		return wt(yt(e), d);
	};
	s = function(e, t, n, r) {
		l = n, f(e ? e + "{" + t.styles + "}" : t.styles), r && (p.inserted[t.name] = !0);
	};
	var p = {
		key: t,
		sheet: new Ae({
			key: t,
			container: a,
			nonce: e.nonce,
			speedy: e.speedy,
			prepend: e.prepend,
			insertionPoint: e.insertionPoint
		}),
		nonce: e.nonce,
		inserted: i,
		registered: {},
		insert: s
	};
	return p.sheet.hydrate(o), p;
}, Rt = /* @__PURE__ */ o(((e) => {
	var t = typeof Symbol == "function" && Symbol.for, n = t ? Symbol.for("react.element") : 60103, r = t ? Symbol.for("react.portal") : 60106, i = t ? Symbol.for("react.fragment") : 60107, a = t ? Symbol.for("react.strict_mode") : 60108, o = t ? Symbol.for("react.profiler") : 60114, s = t ? Symbol.for("react.provider") : 60109, c = t ? Symbol.for("react.context") : 60110, l = t ? Symbol.for("react.async_mode") : 60111, u = t ? Symbol.for("react.concurrent_mode") : 60111, d = t ? Symbol.for("react.forward_ref") : 60112, f = t ? Symbol.for("react.suspense") : 60113, p = t ? Symbol.for("react.suspense_list") : 60120, m = t ? Symbol.for("react.memo") : 60115, h = t ? Symbol.for("react.lazy") : 60116, g = t ? Symbol.for("react.block") : 60121, _ = t ? Symbol.for("react.fundamental") : 60117, v = t ? Symbol.for("react.responder") : 60118, y = t ? Symbol.for("react.scope") : 60119;
	function b(e) {
		if (typeof e == "object" && e) {
			var t = e.$$typeof;
			switch (t) {
				case n: switch (e = e.type, e) {
					case l:
					case u:
					case i:
					case o:
					case a:
					case f: return e;
					default: switch (e &&= e.$$typeof, e) {
						case c:
						case d:
						case h:
						case m:
						case s: return e;
						default: return t;
					}
				}
				case r: return t;
			}
		}
	}
	function x(e) {
		return b(e) === u;
	}
	e.AsyncMode = l, e.ConcurrentMode = u, e.ContextConsumer = c, e.ContextProvider = s, e.Element = n, e.ForwardRef = d, e.Fragment = i, e.Lazy = h, e.Memo = m, e.Portal = r, e.Profiler = o, e.StrictMode = a, e.Suspense = f, e.isAsyncMode = function(e) {
		return x(e) || b(e) === l;
	}, e.isConcurrentMode = x, e.isContextConsumer = function(e) {
		return b(e) === c;
	}, e.isContextProvider = function(e) {
		return b(e) === s;
	}, e.isElement = function(e) {
		return typeof e == "object" && !!e && e.$$typeof === n;
	}, e.isForwardRef = function(e) {
		return b(e) === d;
	}, e.isFragment = function(e) {
		return b(e) === i;
	}, e.isLazy = function(e) {
		return b(e) === h;
	}, e.isMemo = function(e) {
		return b(e) === m;
	}, e.isPortal = function(e) {
		return b(e) === r;
	}, e.isProfiler = function(e) {
		return b(e) === o;
	}, e.isStrictMode = function(e) {
		return b(e) === a;
	}, e.isSuspense = function(e) {
		return b(e) === f;
	}, e.isValidElementType = function(e) {
		return typeof e == "string" || typeof e == "function" || e === i || e === u || e === o || e === a || e === f || e === p || typeof e == "object" && !!e && (e.$$typeof === h || e.$$typeof === m || e.$$typeof === s || e.$$typeof === c || e.$$typeof === d || e.$$typeof === _ || e.$$typeof === v || e.$$typeof === y || e.$$typeof === g);
	}, e.typeOf = b;
})), zt = /* @__PURE__ */ o(((e, t) => {
	t.exports = Rt();
})), Bt = /* @__PURE__ */ o(((e, t) => {
	var n = zt(), r = {
		childContextTypes: !0,
		contextType: !0,
		contextTypes: !0,
		defaultProps: !0,
		displayName: !0,
		getDefaultProps: !0,
		getDerivedStateFromError: !0,
		getDerivedStateFromProps: !0,
		mixins: !0,
		propTypes: !0,
		type: !0
	}, i = {
		name: !0,
		length: !0,
		prototype: !0,
		caller: !0,
		callee: !0,
		arguments: !0,
		arity: !0
	}, a = {
		$$typeof: !0,
		render: !0,
		defaultProps: !0,
		displayName: !0,
		propTypes: !0
	}, o = {
		$$typeof: !0,
		compare: !0,
		defaultProps: !0,
		displayName: !0,
		propTypes: !0,
		type: !0
	}, s = {};
	s[n.ForwardRef] = a, s[n.Memo] = o;
	function c(e) {
		return n.isMemo(e) ? o : s[e.$$typeof] || r;
	}
	var l = Object.defineProperty, u = Object.getOwnPropertyNames, d = Object.getOwnPropertySymbols, f = Object.getOwnPropertyDescriptor, p = Object.getPrototypeOf, m = Object.prototype;
	function h(e, t, n) {
		if (typeof t != "string") {
			if (m) {
				var r = p(t);
				r && r !== m && h(e, r, n);
			}
			var a = u(t);
			d && (a = a.concat(d(t)));
			for (var o = c(e), s = c(t), g = 0; g < a.length; ++g) {
				var _ = a[g];
				if (!i[_] && !(n && n[_]) && !(s && s[_]) && !(o && o[_])) {
					var v = f(t, _);
					try {
						l(e, _, v);
					} catch {}
				}
			}
		}
		return e;
	}
	t.exports = h;
}));
// node_modules/@emotion/utils/dist/emotion-utils.browser.esm.js
function Vt(e, t, n) {
	var r = "";
	return n.split(" ").forEach(function(n) {
		e[n] === void 0 ? n && (r += n + " ") : t.push(e[n] + ";");
	}), r;
}
var Ht = function(e, t, n) {
	var r = e.key + "-" + t.name;
	n === !1 && e.registered[r] === void 0 && (e.registered[r] = t.styles);
}, Ut = function(e, t, n) {
	Ht(e, t, n);
	var r = e.key + "-" + t.name;
	if (e.inserted[t.name] === void 0) {
		var i = t;
		do
			e.insert(t === i ? "." + r : "", i, e.sheet, !0), i = i.next;
		while (i !== void 0);
	}
};
// node_modules/@emotion/hash/dist/emotion-hash.esm.js
function Wt(e) {
	for (var t = 0, n, r = 0, i = e.length; i >= 4; ++r, i -= 4) n = e.charCodeAt(r) & 255 | (e.charCodeAt(++r) & 255) << 8 | (e.charCodeAt(++r) & 255) << 16 | (e.charCodeAt(++r) & 255) << 24, n = (n & 65535) * 1540483477 + ((n >>> 16) * 59797 << 16), n ^= n >>> 24, t = (n & 65535) * 1540483477 + ((n >>> 16) * 59797 << 16) ^ (t & 65535) * 1540483477 + ((t >>> 16) * 59797 << 16);
	switch (i) {
		case 3: t ^= (e.charCodeAt(r + 2) & 255) << 16;
		case 2: t ^= (e.charCodeAt(r + 1) & 255) << 8;
		case 1: t ^= e.charCodeAt(r) & 255, t = (t & 65535) * 1540483477 + ((t >>> 16) * 59797 << 16);
	}
	return t ^= t >>> 13, t = (t & 65535) * 1540483477 + ((t >>> 16) * 59797 << 16), ((t ^ t >>> 15) >>> 0).toString(36);
}
// node_modules/@emotion/unitless/dist/emotion-unitless.esm.js
var Gt = {
	animationIterationCount: 1,
	aspectRatio: 1,
	borderImageOutset: 1,
	borderImageSlice: 1,
	borderImageWidth: 1,
	boxFlex: 1,
	boxFlexGroup: 1,
	boxOrdinalGroup: 1,
	columnCount: 1,
	columns: 1,
	flex: 1,
	flexGrow: 1,
	flexPositive: 1,
	flexShrink: 1,
	flexNegative: 1,
	flexOrder: 1,
	gridRow: 1,
	gridRowEnd: 1,
	gridRowSpan: 1,
	gridRowStart: 1,
	gridColumn: 1,
	gridColumnEnd: 1,
	gridColumnSpan: 1,
	gridColumnStart: 1,
	msGridRow: 1,
	msGridRowSpan: 1,
	msGridColumn: 1,
	msGridColumnSpan: 1,
	fontWeight: 1,
	lineHeight: 1,
	opacity: 1,
	order: 1,
	orphans: 1,
	scale: 1,
	tabSize: 1,
	widows: 1,
	zIndex: 1,
	zoom: 1,
	WebkitLineClamp: 1,
	fillOpacity: 1,
	floodOpacity: 1,
	stopOpacity: 1,
	strokeDasharray: 1,
	strokeDashoffset: 1,
	strokeMiterlimit: 1,
	strokeOpacity: 1,
	strokeWidth: 1
}, Kt = /[A-Z]|^ms/g, qt = /_EMO_([^_]+?)_([^]*?)_EMO_/g, Jt = function(e) {
	return e.charCodeAt(1) === 45;
}, Yt = function(e) {
	return e != null && typeof e != "boolean";
}, F = /* #__PURE__ */ Ot(function(e) {
	return Jt(e) ? e : e.replace(Kt, "-$&").toLowerCase();
}), Xt = function(e, t) {
	switch (e) {
		case "animation":
		case "animationName": if (typeof t == "string") return t.replace(qt, function(e, t, n) {
			return en = {
				name: t,
				styles: n,
				next: en
			}, t;
		});
	}
	return Gt[e] !== 1 && !Jt(e) && typeof t == "number" && t !== 0 ? t + "px" : t;
};
function Zt(e, t, n) {
	if (n == null) return "";
	var r = n;
	if (r.__emotion_styles !== void 0) return r;
	switch (typeof n) {
		case "boolean": return "";
		case "object":
			var i = n;
			if (i.anim === 1) return en = {
				name: i.name,
				styles: i.styles,
				next: en
			}, i.name;
			var a = n;
			if (a.styles !== void 0) {
				var o = a.next;
				if (o !== void 0) for (; o !== void 0;) en = {
					name: o.name,
					styles: o.styles,
					next: en
				}, o = o.next;
				return a.styles + ";";
			}
			return Qt(e, t, n);
		case "function": if (e !== void 0) {
			var s = en, c = n(e);
			return en = s, Zt(e, t, c);
		}
	}
	var l = n;
	if (t == null) return l;
	var u = t[l];
	return u === void 0 ? l : u;
}
function Qt(e, t, n) {
	var r = "";
	if (Array.isArray(n)) for (var i = 0; i < n.length; i++) r += Zt(e, t, n[i]) + ";";
	else for (var a in n) {
		var o = n[a];
		if (typeof o != "object") {
			var s = o;
			t != null && t[s] !== void 0 ? r += a + "{" + t[s] + "}" : Yt(s) && (r += F(a) + ":" + Xt(a, s) + ";");
		} else if (Array.isArray(o) && typeof o[0] == "string" && (t == null || t[o[0]] === void 0)) for (var c = 0; c < o.length; c++) Yt(o[c]) && (r += F(a) + ":" + Xt(a, o[c]) + ";");
		else {
			var l = Zt(e, t, o);
			switch (a) {
				case "animation":
				case "animationName":
					r += F(a) + ":" + l + ";";
					break;
				default: r += a + "{" + l + "}";
			}
		}
	}
	return r;
}
var $t = /label:\s*([^\s;{]+)\s*(;|$)/g, en;
function tn(e, t, n) {
	if (e.length === 1 && typeof e[0] == "object" && e[0] !== null && e[0].styles !== void 0) return e[0];
	var r = !0, i = "";
	en = void 0;
	var a = e[0];
	a == null || a.raw === void 0 ? (r = !1, i += Zt(n, t, a)) : i += a[0];
	for (var o = 1; o < e.length; o++) i += Zt(n, t, e[o]), r && (i += a[o]);
	$t.lastIndex = 0;
	for (var s = "", c; (c = $t.exec(i)) !== null;) s += "-" + c[1];
	return {
		name: Wt(i) + s,
		styles: i,
		next: en
	};
}
// node_modules/@emotion/use-insertion-effect-with-fallbacks/dist/emotion-use-insertion-effect-with-fallbacks.browser.esm.js
var nn = function(e) {
	return e();
}, rn = _.useInsertionEffect ? _.useInsertionEffect : !1, an = rn || nn, on = rn || _.useLayoutEffect, sn = /* #__PURE__ */ _.createContext(typeof HTMLElement < "u" ? /* #__PURE__ */ Lt({ key: "css" }) : null);
sn.Provider;
var cn = function(e) {
	return /*#__PURE__*/ (0, _.forwardRef)(function(t, n) {
		return e(t, (0, _.useContext)(sn), n);
	});
}, ln = /* #__PURE__ */ _.createContext({}), un = {}.hasOwnProperty, dn = "__EMOTION_TYPE_PLEASE_DO_NOT_USE__", fn = function(e, t) {
	var n = {};
	for (var r in t) un.call(t, r) && (n[r] = t[r]);
	return n[dn] = e, n;
}, pn = function(e) {
	var t = e.cache, n = e.serialized, r = e.isStringTag;
	return Ht(t, n, r), an(function() {
		return Ut(t, n, r);
	}), null;
}, mn = /* @__PURE__ */ cn(function(e, t, n) {
	var r = e.css;
	typeof r == "string" && t.registered[r] !== void 0 && (r = t.registered[r]);
	var i = e[dn], a = [r], o = "";
	typeof e.className == "string" ? o = Vt(t.registered, a, e.className) : e.className != null && (o = e.className + " ");
	var s = tn(a, void 0, _.useContext(ln));
	o += t.key + "-" + s.name;
	var c = {};
	for (var l in e) un.call(e, l) && l !== "css" && l !== dn && (c[l] = e[l]);
	return c.className = o, n && (c.ref = n), /*#__PURE__*/ _.createElement(_.Fragment, null, /*#__PURE__*/ _.createElement(pn, {
		cache: t,
		serialized: s,
		isStringTag: typeof i == "string"
	}), /*#__PURE__*/ _.createElement(i, c));
});
Bt();
var hn = function(e, t) {
	var n = arguments;
	if (t == null || !un.call(t, "css")) return _.createElement.apply(void 0, n);
	var r = n.length, i = Array(r);
	i[0] = mn, i[1] = fn(e, t);
	for (var a = 2; a < r; a++) i[a] = n[a];
	return _.createElement.apply(null, i);
};
(function(e) {
	var t;
	t ||= e.JSX ||= {};
})(hn ||= {});
var gn = /* #__PURE__ */ cn(function(e, t) {
	var n = e.styles, r = tn([n], void 0, _.useContext(ln)), i = _.useRef();
	return on(function() {
		var e = t.key + "-global", n = new t.sheet.constructor({
			key: e,
			nonce: t.sheet.nonce,
			container: t.sheet.container,
			speedy: t.sheet.isSpeedy
		}), a = !1, o = document.querySelector("style[data-emotion=\"" + e + " " + r.name + "\"]");
		return t.sheet.tags.length && (n.before = t.sheet.tags[0]), o !== null && (a = !0, o.setAttribute("data-emotion", e), n.hydrate([o])), i.current = [n, a], function() {
			n.flush();
		};
	}, [t]), on(function() {
		var e = i.current, n = e[0];
		e[1] ? e[1] = !1 : (r.next !== void 0 && Ut(t, r.next, !0), n.tags.length && (n.before = n.tags[n.tags.length - 1].nextElementSibling, n.flush()), t.insert("", r, n, !1));
	}, [t, r.name]), null;
});
function I() {
	return tn([...arguments]);
}
function _n() {
	var e = I.apply(void 0, arguments), t = "animation-" + e.name;
	return {
		name: t,
		styles: "@keyframes " + t + "{" + e.styles + "}",
		anim: 1,
		toString: function() {
			return "_EMO_" + this.name + "_" + this.styles + "_EMO_";
		}
	};
}
// node_modules/@montage-ui/theme/dist/utils/index.mjs
var vn = /* @__PURE__ */ c((/* @__PURE__ */ o(((e, t, n) => {
	(function(e, n) {
		/*istanbul ignore next:cant test*/
		typeof t == "object" && typeof t.exports == "object" ? t.exports = n() : typeof define == "function" && define.amd ? define([], n) : e.objectPath = n();
	})(n, function() {
		var e = Object.prototype.toString;
		function t(e, t) {
			return e != null && Object.prototype.hasOwnProperty.call(e, t);
		}
		function n(e) {
			if (!e || a(e) && e.length === 0) return !0;
			if (typeof e != "string") {
				for (var n in e) if (t(e, n)) return !1;
				return !0;
			}
			return !1;
		}
		function r(t) {
			return e.call(t);
		}
		function i(e) {
			return typeof e == "object" && r(e) === "[object Object]";
		}
		var a = Array.isArray || function(t) {
			/*istanbul ignore next:cant test*/
			return e.call(t) === "[object Array]";
		};
		function o(e) {
			return typeof e == "boolean" || r(e) === "[object Boolean]";
		}
		function s(e) {
			var t = parseInt(e);
			return t.toString() === e ? t : e;
		}
		function c(e) {
			e ||= {};
			var r = function(e) {
				return Object.keys(r).reduce(function(t, n) {
					return n === "create" || 
					/*istanbul ignore else*/
					typeof r[n] == "function" && (t[n] = r[n].bind(r, e)), t;
				}, {});
			}, c = e.includeInheritedProps ? function() {
				return !0;
			} : function(e, n) {
				return typeof n == "number" && Array.isArray(e) || t(e, n);
			};
			function l(e, t) {
				if (c(e, t)) return e[t];
			}
			var u = e.includeInheritedProps ? function(e, t) {
				typeof t != "string" && typeof t != "number" && (t = String(t));
				var n = l(e, t);
				if (t === "__proto__" || t === "prototype" || t === "constructor" && typeof n == "function") throw Error("For security reasons, object's magic properties cannot be set");
				return n;
			} : function(e, t) {
				return l(e, t);
			};
			function d(e, t, n, r) {
				if (typeof t == "number" && (t = [t]), !t || t.length === 0) return e;
				if (typeof t == "string") return d(e, t.split(".").map(s), n, r);
				var i = t[0], a = u(e, i);
				return t.length === 1 ? (a !== void 0 && r || (e[i] = n), a) : (a === void 0 && (e[i] = typeof t[1] == "number" ? [] : {}), d(e[i], t.slice(1), n, r));
			}
			return r.has = function(n, r) {
				if (typeof r == "number" ? r = [r] : typeof r == "string" && (r = r.split(".")), !r || r.length === 0) return !!n;
				for (var i = 0; i < r.length; i++) {
					var o = s(r[i]);
					if (typeof o == "number" && a(n) && o < n.length || (e.includeInheritedProps ? o in Object(n) : t(n, o))) n = n[o];
					else return !1;
				}
				return !0;
			}, r.ensureExists = function(e, t, n) {
				return d(e, t, n, !0);
			}, r.set = function(e, t, n, r) {
				return d(e, t, n, r);
			}, r.insert = function(e, t, n, i) {
				var o = r.get(e, t);
				i = ~~i, a(o) || (o = [], r.set(e, t, o)), o.splice(i, 0, n);
			}, r.empty = function(e, t) {
				if (!n(t) && e != null) {
					var s, l;
					if (s = r.get(e, t)) {
						if (typeof s == "string") return r.set(e, t, "");
						if (o(s)) return r.set(e, t, !1);
						if (typeof s == "number") return r.set(e, t, 0);
						if (a(s)) s.length = 0;
						else if (i(s)) for (l in s) c(s, l) && delete s[l];
						else return r.set(e, t, null);
					}
				}
			}, r.push = function(e, t) {
				var n = r.get(e, t);
				a(n) || (n = [], r.set(e, t, n)), n.push.apply(n, Array.prototype.slice.call(arguments, 2));
			}, r.coalesce = function(e, t, n) {
				for (var i, a = 0, o = t.length; a < o; a++) if ((i = r.get(e, t[a])) !== void 0) return i;
				return n;
			}, r.get = function(e, t, n) {
				if (typeof t == "number" && (t = [t]), !t || t.length === 0) return e;
				if (e == null) return n;
				if (typeof t == "string") return r.get(e, t.split("."), n);
				var i = s(t[0]), a = u(e, i);
				return a === void 0 ? n : t.length === 1 ? a : r.get(e[i], t.slice(1), n);
			}, r.del = function(e, t) {
				if (typeof t == "number" && (t = [t]), e == null || n(t)) return e;
				if (typeof t == "string") return r.del(e, t.split("."));
				var i = s(t[0]);
				if (u(e, i), !c(e, i)) return e;
				if (t.length === 1) a(e) ? e.splice(i, 1) : delete e[i];
				else return r.del(e[i], t.slice(1));
				return e;
			}, r;
		}
		var l = c();
		return l.create = c, l.withInheritedProps = c({ includeInheritedProps: !0 }), l;
	});
})))(), 1), yn = (e, t) => vn.default.get(e, t), L = (e, t) => e.substring(0, 7) + Math.round(t * 255).toString(16).padStart(2, "0").toUpperCase(), R = {
	blue: {
		10: "#001536",
		20: "#002966",
		30: "#003E9C",
		40: "#0054D1",
		45: "#005EEB",
		50: "#0066FF",
		55: "#1A75FF",
		60: "#3385FF",
		65: "#4F95FF",
		70: "#69A5FF",
		80: "#9EC5FF",
		90: "#C9DEFE",
		95: "#EAF2FE",
		99: "#F7FBFF"
	},
	common: {
		0: "#000000",
		100: "#ffffff"
	},
	coolNeutral: {
		5: "#0F0F10",
		7: "#141415",
		10: "#171719",
		15: "#1B1C1E",
		17: "#212225",
		20: "#292A2D",
		22: "#2E2F33",
		23: "#333438",
		25: "#37383C",
		30: "#46474C",
		40: "#5A5C63",
		50: "#70737C",
		60: "#878A93",
		70: "#989BA2",
		80: "#AEB0B6",
		90: "#C2C4C8",
		95: "#DBDCDF",
		96: "#E1E2E4",
		97: "#EAEBEC",
		98: "#F4F4F5",
		99: "#F7F7F8"
	},
	cyan: {
		10: "#00252B",
		20: "#004854",
		30: "#006F82",
		40: "#0098B2",
		50: "#00BDDE",
		60: "#28D0ED",
		70: "#57DFF7",
		80: "#8AEDFF",
		90: "#B5F4FF",
		95: "#DEFAFF",
		99: "#F7FEFF"
	},
	green: {
		10: "#00240C",
		20: "#004517",
		30: "#006E25",
		40: "#009632",
		50: "#00BF40",
		60: "#1ED45A",
		70: "#49E57D",
		80: "#7DF5A5",
		90: "#ACFCC7",
		95: "#D9FFE6",
		99: "#F2FFF6"
	},
	lightBlue: {
		10: "#002130",
		20: "#004261",
		30: "#006796",
		40: "#008DCF",
		50: "#00AEFF",
		60: "#3DC2FF",
		70: "#70D2FF",
		80: "#A1E1FF",
		90: "#C4ECFE",
		95: "#E5F6FE",
		99: "#F7FDFF"
	},
	lime: {
		10: "#112900",
		20: "#225200",
		30: "#347D00",
		37: "#429E00",
		40: "#48AD00",
		50: "#58CF04",
		60: "#6BE016",
		70: "#88F03E",
		80: "#AEF779",
		90: "#CCFCA9",
		95: "#E6FFD4",
		99: "#F8FFF2"
	},
	neutral: {
		5: "#0F0F0F",
		10: "#171717",
		15: "#1C1C1C",
		20: "#2A2A2A",
		22: "#303030",
		30: "#474747",
		40: "#5C5C5C",
		50: "#737373",
		60: "#8A8A8A",
		70: "#9B9B9B",
		80: "#B0B0B0",
		90: "#C4C4C4",
		95: "#DCDCDC",
		99: "#F7F7F7"
	},
	orange: {
		10: "#361E00",
		20: "#663A00",
		30: "#9C5800",
		39: "#D17600",
		40: "#D47800",
		50: "#FF9200",
		60: "#FFA938",
		70: "#FFC06E",
		80: "#FFD49C",
		90: "#FEE6C6",
		95: "#FEF4E6",
		99: "#FFFCF7"
	},
	pink: {
		10: "#3D0133",
		20: "#730560",
		30: "#A81690",
		40: "#D331B8",
		46: "#E846CD",
		50: "#F553DA",
		60: "#FA73E3",
		70: "#FF94ED",
		80: "#FFB8F3",
		90: "#FED3F7",
		95: "#FEECFB",
		99: "#FFFAFE"
	},
	purple: {
		99: "#FEFBFF",
		95: "#F9EDFF",
		90: "#F2D6FF",
		80: "#E9BAFF",
		70: "#DE96FF",
		60: "#D478FF",
		50: "#CB59FF",
		40: "#AD36E3",
		30: "#861CB8",
		20: "#580A7D",
		10: "#290247"
	},
	red: {
		10: "#3B0101",
		20: "#730303",
		30: "#B00C0C",
		40: "#E52222",
		50: "#FF4242",
		60: "#FF6363",
		70: "#FF8C8C",
		80: "#FFB5B5",
		90: "#FED5D5",
		95: "#FEECEC",
		99: "#FFFAFA"
	},
	violet: {
		10: "#11024D",
		20: "#23098F",
		30: "#3A16C9",
		40: "#4F29E5",
		45: "#5B37ED",
		50: "#6541F2",
		60: "#7D5EF7",
		70: "#9E86FC",
		80: "#C0B0FF",
		90: "#DBD3FE",
		95: "#F0ECFE",
		99: "#FBFAFF"
	},
	redOrange: {
		10: "#290F00",
		20: "#592100",
		30: "#913500",
		40: "#C94A00",
		48: "#F55A00",
		50: "#FF5E00",
		60: "#FF7B2E",
		70: "#FF9B61",
		80: "#FFBD96",
		90: "#FED9C4",
		95: "#FEEEE5",
		99: "#FFFAF7"
	}
}, bn = {
	xl: "1600px",
	lg: "1200px",
	md: "992px",
	sm: "768px",
	xs: "0px"
}, z = {
	0: "0px",
	1: "1px",
	2: "2px",
	4: "4px",
	6: "6px",
	8: "8px",
	10: "10px",
	12: "12px",
	14: "14px",
	16: "16px",
	18: "18px",
	20: "20px",
	24: "24px",
	28: "28px",
	32: "32px",
	36: "36px",
	40: "40px",
	48: "48px",
	56: "56px",
	64: "64px",
	72: "72px",
	80: "80px",
	9999: "9999px"
}, xn = {
	12: z[12],
	14: z[14],
	16: z[16],
	18: z[18],
	20: z[20],
	24: z[24],
	28: z[28],
	32: z[32],
	36: z[36],
	40: z[40],
	48: z[48],
	56: z[56],
	64: z[64]
}, B = {
	0: 0,
	5: .05,
	8: .08,
	12: .12,
	16: .16,
	22: .22,
	28: .28,
	35: .35,
	43: .43,
	52: .52,
	61: .61,
	74: .74,
	88: .88,
	97: .97,
	100: 1
}, Sn = {
	0: z[0],
	4: z[4],
	8: z[8],
	10: z[10],
	12: z[12],
	14: z[14],
	16: z[16],
	20: z[20],
	24: z[24],
	28: z[28],
	32: z[32],
	full: z[9999]
}, Cn = {
	static: {
		white: R.common[100],
		black: R.common[0]
	},
	foreground: {
		neutral: {
			primary: R.coolNeutral[10],
			strong: R.common[0],
			secondary: L(R.coolNeutral[22], B[88]),
			tertiary: L(R.coolNeutral[25], B[61]),
			quaternary: L(R.coolNeutral[25], B[28]),
			inverse: R.coolNeutral[99]
		},
		brand: {
			primary: R.blue[50],
			inverse: R.blue[60]
		},
		positive: { primary: R.green[50] },
		cautionary: { primary: R.orange[50] },
		negative: {
			primary: R.red[50],
			strong: R.red[40]
		},
		disable: { primary: L(R.coolNeutral[25], B[16]) },
		inactive: { primary: R.coolNeutral[70] },
		accent: {
			lime: R.lime[37],
			cyan: R.cyan[40],
			lightBlue: R.lightBlue[40],
			violet: R.violet[45],
			purple: R.purple[40],
			pink: R.pink[46]
		}
	},
	background: { neutral: {
		primary: R.common[100],
		secondary: R.coolNeutral[99]
	} },
	surface: {
		neutral: {
			primary: R.common[100],
			secondary: L(R.coolNeutral[50], B[8]),
			tertiary: L(R.coolNeutral[50], B[5]),
			strong: L(R.coolNeutral[50], B[16]),
			inverse: R.coolNeutral[15]
		},
		elevated: {
			primary: R.common[100],
			secondary: R.coolNeutral[99]
		},
		brand: {
			primary: R.blue[50],
			strong: R.blue[45],
			heavy: R.blue[40],
			subtle: L(R.blue[50], B[5])
		},
		positive: { primary: L(R.green[50], B[8]) },
		cautionary: { primary: L(R.orange[50], B[8]) },
		negative: {
			primary: L(R.red[50], B[8]),
			strong: L(R.red[50], B[12])
		},
		disable: { primary: R.coolNeutral[98] },
		accent: {
			lime: L(R.lime[50], B[8]),
			limeOpaque: R.lime[50],
			cyan: L(R.cyan[50], B[8]),
			cyanOpaque: R.cyan[50],
			lightBlue: L(R.lightBlue[50], B[8]),
			lightBlueOpaque: R.lightBlue[50],
			violet: L(R.violet[50], B[8]),
			violetOpaque: R.violet[50],
			purple: L(R.purple[50], B[8]),
			purpleOpaque: R.purple[50],
			pink: L(R.pink[50], B[8]),
			pinkOpaque: R.pink[50]
		}
	},
	line: {
		neutral: {
			primary: L(R.coolNeutral[50], B[22]),
			primaryOpaque: R.coolNeutral[96],
			secondary: L(R.coolNeutral[50], B[16]),
			secondaryOpaque: R.coolNeutral[97],
			tertiary: L(R.coolNeutral[50], B[8]),
			tertiaryOpaque: R.coolNeutral[98]
		},
		brand: {
			primary: L(R.blue[50], B[28]),
			strong: L(R.blue[50], B[43]),
			focus: L(R.blue[50], B[12])
		},
		cautionary: { primary: L(R.orange[50], B[43]) },
		positive: { primary: L(R.green[50], B[43]) },
		negative: {
			primary: L(R.red[50], B[43]),
			strong: L(R.red[50], B[52]),
			focus: L(R.red[50], B[12])
		},
		accent: {
			lime: L(R.lime[37], B[43]),
			cyan: L(R.cyan[40], B[43]),
			lightBlue: L(R.lightBlue[40], B[43]),
			violet: L(R.violet[45], B[43]),
			purple: L(R.purple[40], B[43]),
			pink: L(R.pink[46], B[43])
		}
	},
	effect: {
		dimmer: { primary: L(R.coolNeutral[10], B[52]) },
		transparent: {
			primary: L(R.common[100], B[8]),
			secondary: L(R.common[100], B[28])
		}
	},
	elevation: { shadow: {
		normal: {
			xsmall: `0px 1px 2px -1px ${L(R.neutral[10], .1)}`,
			small: `0px 2px 4px -2px ${L(R.neutral[10], .06)}, 0px 4px 6px -1px ${L(R.neutral[10], .06)}`,
			medium: `0px 4px 6px -2px ${L(R.neutral[10], .07)}, 0px 10px 15px -3px ${L(R.neutral[10], .07)}`,
			large: `0px 6px 10px -4px ${L(R.neutral[10], .08)}, 0px 16px 24px -6px ${L(R.neutral[10], .08)}`,
			xlarge: `0px 10px 15px -5px ${L(R.neutral[10], .1)}, 0px 24px 38px -10px ${L(R.neutral[10], .12)}`
		},
		drop: {
			xsmall: `drop-shadow(0px 1px 0.5px ${L(R.neutral[10], .05)})`,
			small: `drop-shadow(0px 2px 1px ${L(R.neutral[10], .03)}) drop-shadow(0px 4px 2.5px ${L(R.neutral[10], .03)})`,
			medium: `drop-shadow(0px 4px 2px ${L(R.neutral[10], .035)}) drop-shadow(0px 10px 6px ${L(R.neutral[10], .035)})`,
			large: `drop-shadow(0px 6px 3px ${L(R.neutral[10], .04)}) drop-shadow(0px 16px 9px ${L(R.neutral[10], .03)})`,
			xlarge: `drop-shadow(0px 10px 5px ${L(R.neutral[10], .05)}) drop-shadow(0px 24px 14px ${L(R.neutral[10], .06)})`
		},
		spread: {
			small: `0px 0px 60px 0px ${L(R.neutral[10], .1)}`,
			medium: `0px 15px 75px 0px ${L(R.neutral[10], .16)}`
		}
	} }
}, wn = {
	static: {
		white: R.common[100],
		black: R.common[0]
	},
	foreground: {
		neutral: {
			primary: R.coolNeutral[99],
			strong: R.common[100],
			secondary: L(R.coolNeutral[90], B[88]),
			tertiary: L(R.coolNeutral[80], B[61]),
			quaternary: L(R.coolNeutral[80], B[28]),
			inverse: R.coolNeutral[10]
		},
		brand: {
			primary: R.blue[60],
			inverse: R.blue[50]
		},
		positive: { primary: R.green[60] },
		cautionary: { primary: R.orange[60] },
		negative: {
			primary: R.red[60],
			strong: R.red[60]
		},
		disable: { primary: L(R.coolNeutral[70], B[16]) },
		inactive: { primary: R.coolNeutral[40] },
		accent: {
			lime: R.lime[50],
			cyan: R.cyan[50],
			lightBlue: R.lightBlue[50],
			violet: R.violet[70],
			purple: R.purple[60],
			pink: R.pink[60]
		}
	},
	background: { neutral: {
		primary: R.coolNeutral[15],
		secondary: R.coolNeutral[5]
	} },
	surface: {
		neutral: {
			primary: R.coolNeutral[15],
			secondary: L(R.coolNeutral[50], B[22]),
			tertiary: L(R.coolNeutral[50], B[12]),
			strong: L(R.coolNeutral[50], B[28]),
			inverse: R.common[100]
		},
		elevated: {
			primary: R.coolNeutral[17],
			secondary: R.coolNeutral[7]
		},
		brand: {
			primary: R.blue[60],
			strong: R.blue[55],
			heavy: R.blue[50],
			subtle: L(R.blue[60], B[5])
		},
		positive: { primary: L(R.green[60], B[8]) },
		cautionary: { primary: L(R.orange[60], B[8]) },
		negative: {
			primary: L(R.red[60], B[8]),
			strong: L(R.red[60], B[22])
		},
		disable: { primary: R.coolNeutral[22] },
		accent: {
			lime: L(R.lime[60], B[8]),
			limeOpaque: R.lime[60],
			cyan: L(R.cyan[60], B[8]),
			cyanOpaque: R.cyan[60],
			lightBlue: L(R.lightBlue[60], B[8]),
			lightBlueOpaque: R.lightBlue[60],
			violet: L(R.violet[60], B[8]),
			violetOpaque: R.violet[60],
			purple: L(R.purple[60], B[8]),
			purpleOpaque: R.purple[60],
			pink: L(R.pink[60], B[8]),
			pinkOpaque: R.pink[60]
		}
	},
	line: {
		neutral: {
			primary: L(R.coolNeutral[50], .32),
			primaryOpaque: R.coolNeutral[25],
			secondary: L(R.coolNeutral[50], B[28]),
			secondaryOpaque: R.coolNeutral[23],
			tertiary: L(R.coolNeutral[50], B[22]),
			tertiaryOpaque: R.coolNeutral[22]
		},
		brand: {
			primary: L(R.blue[60], B[28]),
			strong: L(R.blue[60], B[43]),
			focus: L(R.blue[60], B[12])
		},
		positive: { primary: L(R.green[60], B[43]) },
		cautionary: { primary: L(R.orange[60], B[43]) },
		negative: {
			primary: L(R.red[60], B[43]),
			strong: L(R.red[60], B[52]),
			focus: L(R.red[60], B[12])
		},
		accent: {
			lime: L(R.lime[50], B[43]),
			cyan: L(R.cyan[50], B[43]),
			lightBlue: L(R.lightBlue[50], B[43]),
			violet: L(R.violet[70], B[43]),
			purple: L(R.purple[60], B[43]),
			pink: L(R.pink[60], B[43])
		}
	},
	effect: {
		dimmer: { primary: L(R.coolNeutral[10], B[74]) },
		transparent: {
			primary: L(R.coolNeutral[17], B[61]),
			secondary: L(R.coolNeutral[17], B[61])
		}
	},
	elevation: { shadow: {
		normal: {
			xsmall: `0px 1px 2px -1px ${L(R.neutral[10], .1)}`,
			small: `0px 2px 4px -2px ${L(R.neutral[10], .06)}, 0px 4px 6px -1px ${L(R.neutral[10], .06)}`,
			medium: `0px 4px 6px -2px ${L(R.neutral[10], .07)}, 0px 10px 15px -3px ${L(R.neutral[10], .07)}`,
			large: `0px 6px 10px -4px ${L(R.neutral[10], .08)}, 0px 16px 24px -6px ${L(R.neutral[10], .08)}`,
			xlarge: `0px 10px 15px -5px ${L(R.neutral[10], .1)}, 0px 24px 38px -10px ${L(R.neutral[10], .12)}`
		},
		drop: {
			xsmall: `drop-shadow(0px 1px 0.5px ${L(R.neutral[10], .05)})`,
			small: `drop-shadow(0px 2px 1px ${L(R.neutral[10], .03)}) drop-shadow(0px 4px 2.5px ${L(R.neutral[10], .03)})`,
			medium: `drop-shadow(0px 4px 2px ${L(R.neutral[10], .035)}) drop-shadow(0px 10px 6px ${L(R.neutral[10], .035)})`,
			large: `drop-shadow(0px 6px 3px ${L(R.neutral[10], .04)}) drop-shadow(0px 16px 9px ${L(R.neutral[10], .03)})`,
			xlarge: `drop-shadow(0px 10px 5px ${L(R.neutral[10], .05)}) drop-shadow(0px 24px 14px ${L(R.neutral[10], .06)})`
		},
		spread: {
			small: `0px 0px 60px 0px ${L(R.neutral[10], .1)}`,
			medium: `0px 15px 75px 0px ${L(R.neutral[10], .16)}`
		}
	} }
}, Tn = {
	0: z[0],
	.5: "0.5px",
	2: z[2],
	4: z[4],
	6: z[6],
	8: z[8],
	10: z[10],
	12: z[12],
	14: z[14],
	16: z[16],
	20: z[20],
	24: z[24],
	32: z[32],
	40: z[40],
	48: z[48],
	56: z[56],
	64: z[64],
	72: z[72],
	80: z[80]
}, En = {
	display1: {
		fontSize: "3.5rem",
		lineHeight: "4.5rem",
		letterSpacing: "-0.0319em",
		weight: {
			regular: 400,
			medium: 500,
			bold: 700
		}
	},
	display2: {
		fontSize: "2.5rem",
		lineHeight: "3.25rem",
		letterSpacing: "-0.0282em",
		weight: {
			regular: 400,
			medium: 500,
			bold: 700
		}
	},
	display3: {
		fontSize: "2.25rem",
		lineHeight: "3rem",
		letterSpacing: "-0.027em",
		weight: {
			regular: 400,
			medium: 500,
			bold: 700
		}
	},
	title1: {
		fontSize: "2rem",
		lineHeight: "2.75rem",
		letterSpacing: "-0.0253em",
		weight: {
			regular: 400,
			medium: 500,
			bold: 700
		}
	},
	title2: {
		fontSize: "1.75rem",
		lineHeight: "2.375rem",
		letterSpacing: "-0.0236em",
		weight: {
			regular: 400,
			medium: 500,
			bold: 700
		}
	},
	title3: {
		fontSize: "1.5rem",
		lineHeight: "2rem",
		letterSpacing: "-0.023em",
		weight: {
			regular: 400,
			medium: 500,
			bold: 700
		}
	},
	heading1: {
		fontSize: "1.375rem",
		lineHeight: "1.875rem",
		letterSpacing: "-0.0194em",
		weight: {
			regular: 400,
			medium: 500,
			bold: 600
		}
	},
	heading2: {
		fontSize: "1.25rem",
		lineHeight: "1.75rem",
		letterSpacing: "-0.012em",
		weight: {
			regular: 400,
			medium: 500,
			bold: 600
		}
	},
	headline1: {
		fontSize: "1.125rem",
		lineHeight: "1.625rem",
		letterSpacing: "-0.002em",
		weight: {
			regular: 400,
			medium: 500,
			bold: 600
		}
	},
	headline2: {
		fontSize: "1.0625rem",
		lineHeight: "1.5rem",
		letterSpacing: "0em",
		weight: {
			regular: 400,
			medium: 500,
			bold: 600
		}
	},
	body1: {
		fontSize: "1rem",
		lineHeight: "1.5rem",
		letterSpacing: "0.0057em",
		weight: {
			regular: 400,
			medium: 500,
			bold: 600
		}
	},
	body1Reading: {
		fontSize: "1rem",
		lineHeight: "1.625rem",
		letterSpacing: "0.0057em",
		weight: {
			regular: 400,
			medium: 500,
			bold: 600
		}
	},
	body2: {
		fontSize: "0.9375rem",
		lineHeight: "1.375rem",
		letterSpacing: "0.0096em",
		weight: {
			regular: 400,
			medium: 500,
			bold: 600
		}
	},
	body2Reading: {
		fontSize: "0.9375rem",
		lineHeight: "1.5rem",
		letterSpacing: "0.0096em",
		weight: {
			regular: 400,
			medium: 500,
			bold: 600
		}
	},
	label1: {
		fontSize: "0.875rem",
		lineHeight: "1.25rem",
		letterSpacing: "0.0145em",
		weight: {
			regular: 400,
			medium: 500,
			bold: 600
		}
	},
	label1Reading: {
		fontSize: "0.875rem",
		lineHeight: "1.375rem",
		letterSpacing: "0.0145em",
		weight: {
			regular: 400,
			medium: 500,
			bold: 600
		}
	},
	label2: {
		fontSize: "0.8125rem",
		lineHeight: "1.125rem",
		letterSpacing: "0.0194em",
		weight: {
			regular: 400,
			medium: 500,
			bold: 600
		}
	},
	caption1: {
		fontSize: "0.75rem",
		lineHeight: "1rem",
		letterSpacing: "0.0252em",
		weight: {
			regular: 400,
			medium: 500,
			bold: 600
		}
	},
	caption2: {
		fontSize: "0.6875rem",
		lineHeight: "0.875rem",
		letterSpacing: "0.0311em",
		weight: {
			regular: 400,
			medium: 500,
			bold: 600
		}
	}
}, Dn = { modal: 1300 }, On = {
	atomic: R,
	semantic: {
		...Cn,
		platform: { ios: { navigation: `
          background-color: ${L(Cn.surface.elevated.primary, B[88])};
          backdrop-filter: blur(32px);
      ` } }
	},
	opacity: B,
	breakpoint: bn,
	primitive: z,
	spacing: Tn,
	radius: Sn,
	dimension: xn,
	typography: En,
	zIndex: Dn
}, kn = {
	atomic: R,
	semantic: {
		...wn,
		platform: { ios: { navigation: `
          background-color: ${L(wn.surface.elevated.primary, B[88])};
          backdrop-filter: blur(32px);
      ` } }
	},
	opacity: B,
	breakpoint: bn,
	primitive: z,
	spacing: Tn,
	radius: Sn,
	dimension: xn,
	typography: En,
	zIndex: Dn
}, An = (e) => e.replace(/\./g, "_"), jn = (e, t) => {
	let n = {};
	for (let [r, i] of Object.entries(e)) {
		let e = `${t}-${An(r)}`;
		n[r] = typeof i == "object" && i ? jn(i, e) : `var(--${e})`;
	}
	return n;
}, Mn = jn(R, "atomic"), Nn = jn(z, "primitive"), Pn = jn(B, "opacity"), Fn = jn(Tn, "spacing"), In = jn(Sn, "radius"), Ln = jn(xn, "dimension"), Rn = jn(Dn, "zIndex"), zn = jn(En, "typography"), Bn = { ios: { navigation: "\n      background-color: rgba(var(--semantic-surface-elevated-primary-rgb), 0.88);\n      backdrop-filter: blur(32px);\n    " } }, Vn = {
	light: {
		...On,
		atomic: Mn,
		semantic: {
			...jn(Cn, "semantic"),
			platform: Bn
		},
		primitive: Nn,
		opacity: Pn,
		breakpoint: bn,
		spacing: Fn,
		radius: In,
		dimension: Ln,
		typography: zn,
		zIndex: Rn
	},
	dark: {
		...kn,
		atomic: Mn,
		semantic: {
			...jn(wn, "semantic"),
			platform: Bn
		},
		primitive: Nn,
		opacity: Pn,
		breakpoint: bn,
		spacing: Fn,
		radius: In,
		dimension: Ln,
		typography: zn,
		zIndex: Rn
	}
}, Hn = (0, _.createContext)(Vn.light), Un = () => (0, _.useContext)(Hn), Wn = () => {
	let e = Un();
	return (t) => A(t, e);
}, Gn = function(e, t, n) {
	return un.call(t, "css") ? O.jsx(mn, fn(e, t), n) : O.jsx(e, t, n);
}, V = (0, _.forwardRef)(({ as: e, sx: t, ...n }, r) => /* @__PURE__ */ Gn(e || "div", {
	ref: r,
	css: Wn()(t),
	...n
}));
V.displayName = "Box";
// node_modules/@montage-ui/engine/dist/components/global/index.mjs
var Kn = ({ styles: e }) => /* @__PURE__ */ (0, O.jsx)(gn, { styles: A(e, Un()) }), qn = ({ theme: e = "light", children: t, provider: n }) => {
	let r = (0, _.useMemo)(() => {
		switch (e) {
			case "light": return Vn.light;
			case "dark": return Vn.dark;
			default: console.error("[Montage] Please check if the correct Theme value is set.");
		}
	}, [e]), i = n ?? _.Fragment;
	return /* @__PURE__ */ (0, O.jsx)(Hn.Provider, {
		value: r,
		children: n ? /* @__PURE__ */ (0, O.jsx)(i, {
			theme: r,
			children: t
		}) : t
	});
}, Jn = [
	"xs",
	"sm",
	"md",
	"lg",
	"xl"
], Yn = (e, t) => (n) => I`
      ${Object.entries(e).sort(([e], [t]) => Jn.findIndex((t) => t === e) - Jn.findIndex((e) => e === t)).map(([e, r]) => {
	if (r && Object.values(r).some((e) => e !== void 0)) switch (e) {
		case "xs": return I`
                ${De(t.breakpoint.xs)} {
                  ${n(r, "xs")}
                }
              `;
		case "sm": return I`
                ${De(t.breakpoint.sm)} {
                  ${n(r, "sm")}
                }
              `;
		case "md": return I`
                ${De(t.breakpoint.md)} {
                  ${n(r, "md")}
                }
              `;
		case "lg": return I`
                ${De(t.breakpoint.lg)} {
                  ${n(r, "lg")}
                }
              `;
		case "xl": return I`
                ${De(t.breakpoint.xl)} {
                  ${n(r, "xl")}
                }
              `;
	}
})};
    `, Xn = (e, t, n, r) => {
	switch (r) {
		case "xl": return vn.default.get(e.xl || {}, t) ?? vn.default.get(e.lg || {}, t) ?? vn.default.get(e.md || {}, t) ?? vn.default.get(e.sm || {}, t) ?? vn.default.get(e.xs || {}, t) ?? n;
		case "lg": return vn.default.get(e.lg || {}, t) ?? vn.default.get(e.md || {}, t) ?? vn.default.get(e.sm || {}, t) ?? vn.default.get(e.xs || {}, t) ?? n;
		case "md": return vn.default.get(e.md || {}, t) ?? vn.default.get(e.sm || {}, t) ?? vn.default.get(e.xs || {}, t) ?? n;
		case "sm": return vn.default.get(e.sm || {}, t) ?? vn.default.get(e.xs || {}, t) ?? n;
		default: return vn.default.get(e.xs || {}, t) ?? n;
	}
}, Zn = (e, t, n) => {
	let r = {};
	for (let i of Jn) {
		let a = e[i]?.[t];
		a !== void 0 && (r[i] = { [t]: n(a) });
	}
	return r;
}, Qn = (e, t, n) => {
	if (!t) return e;
	let r = {};
	for (let [i, a] of Jn.entries()) {
		let o = e[a], s = t[a];
		s?.[n] === void 0 || Jn.slice(0, i + 1).some((t) => e[t]?.[n] !== void 0) ? o !== void 0 && (r[a] = o) : r[a] = {
			...o,
			[n]: s[n]
		};
	}
	return r;
}, $n = (e, t, n) => e.base !== void 0 || !t ? e : {
	base: t.base,
	responsive: Qn(e.responsive, t.responsive, n)
}, er = ({ xs: e, sm: t, md: n, lg: r, xl: i, ...a }) => (o) => I`
      display: flex;
      ${tr(a)}

      ${Yn({
	xs: e,
	sm: t,
	md: n,
	lg: r,
	xl: i
}, o)((e) => I`
          ${tr(e)}
          ${e?.sx}
        `)}
    `, tr = ({ flexDirection: e, flexWrap: t, justifyContent: n, alignItems: r, alignContent: i, order: a, flex: o, flexGrow: s, flexShrink: c, alignSelf: l, flexBasis: u, gap: d, rowGap: f, columnGap: p } = {}) => I`
  ${d !== void 0 && I`
      gap: ${k(d)};
    `}
  ${f !== void 0 && I`
      row-gap: ${k(f)};
    `}
  ${p !== void 0 && I`
      column-gap: ${k(p)};
    `}
  ${e !== void 0 && I`
      flex-direction: ${e};
    `}
  ${t !== void 0 && I`
      flex-wrap: ${t};
    `}
  ${n !== void 0 && I`
      justify-content: ${n};
    `}
  ${r !== void 0 && I`
      align-items: ${r};
    `}
  ${i !== void 0 && I`
      align-content: ${i};
    `}
  ${a !== void 0 && I`
      order: ${a};
    `}
  ${o !== void 0 && I`
      flex: ${o};
    `}
  ${s !== void 0 && I`
      flex-grow: ${s};
    `}
  ${c !== void 0 && I`
      flex-shrink: ${c};
    `}
  ${l !== void 0 && I`
      align-self: ${l};
    `}
  ${u !== void 0 && I`
      flex-basis: ${k(u)};
    `}
`, nr = (0, _.forwardRef)(({ as: e, flexDirection: t, flexWrap: n, justifyContent: r, alignItems: i, alignContent: a, order: o, flex: s, flexGrow: c, flexShrink: l, flexBasis: u, alignSelf: d, gap: f, rowGap: p, columnGap: m, xs: h, sm: g, md: _, lg: v, xl: y, ...b }, x) => /* @__PURE__ */ (0, O.jsx)(V, {
	as: e || "div",
	ref: x,
	...b,
	sx: [er({
		flexDirection: t,
		flexWrap: n,
		justifyContent: r,
		alignItems: i,
		alignContent: a,
		order: o,
		flex: s,
		flexGrow: c,
		flexShrink: l,
		flexBasis: u,
		alignSelf: d,
		rowGap: p,
		columnGap: m,
		gap: f,
		xs: h,
		sm: g,
		md: _,
		lg: v,
		xl: y
	}), b.sx]
}));
nr.displayName = "FlexBox";
// node_modules/@montage-ui/core/dist/components/typography/style.mjs
var rr = (e) => e.replace(/[A-Z]/g, (e) => `-${e.toLowerCase()}`), ir = Object.entries(zn), ar = Object.fromEntries(ir.map(([e, t]) => [rr(e), I`
      font-size: ${t.fontSize};
      line-height: ${t.lineHeight};
      letter-spacing: ${t.letterSpacing};
    `])), or = Object.fromEntries(ir.map(([e, t]) => [rr(e), {
	regular: I`
        font-weight: ${t.weight.regular};
      `,
	medium: I`
        font-weight: ${t.weight.medium};
      `,
	bold: I`
        font-weight: ${t.weight.bold};
      `
}])), sr = (e) => or[e], cr = (e, t) => I`
  ${ar[e]};
  ${t && sr(e)[t]};
`, lr = (e = 1) => e === 1 ? I`
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
      ` : I`
        overflow: hidden;
        position: relative;
        /* stylelint-disable */
        display: -webkit-box;
        -webkit-line-clamp: ${e};
        -webkit-box-orient: vertical;
        /* stylelint-enable */
      `;
I`
  list-style-type: disc;
  padding-left: 1.5em;

  ul {
    list-style-type: circle;
    padding-left: 1.5em;
  }

  li::marker {
    font-size: 0.8em;
  }
`;
// node_modules/@montage-ui/core/dist/components/typography/index.mjs
var ur = (0, _.forwardRef)(({ as: e, variant: t = "body1", weight: n = "regular", noWrap: r = !1, display: i, align: a, color: o, sx: s, xs: c, sm: l, md: u, lg: d, xl: f, ...p }, m) => /* @__PURE__ */ (0, O.jsx)(V, {
	as: e || "span",
	ref: m,
	sx: [(e) => I`
            ${cr(t, n)}
            ${r && lr(1)}
            ${!!a && I`
                text-align: ${a};
              `}
            ${!!i && I`
                display: ${i};
              `}
            ${o ? I`
                    color: ${yn(e, o)};
                  ` : I`
                    color: inherit;
                  `}

            ${Yn({
		xs: c,
		sm: l,
		md: u,
		lg: d,
		xl: f
	}, e)((e, r) => I`
                ${(!!e?.variant || !!e?.weight) && cr(Xn({
		xs: c,
		sm: l,
		md: u,
		lg: d,
		xl: f
	}, "variant", t, r), Xn({
		xs: c,
		sm: l,
		md: u,
		lg: d,
		xl: f
	}, "weight", n, r))}

                ${!!e?.align && I`
                    text-align: ${e?.align};
                  `}

                ${e?.sx}
              `)};
          `, s],
	...p
}));
ur.displayName = "Typography";
// node_modules/@montage-ui/core/dist/components/with-interaction/style.mjs
var dr = ({ color: e, width: t, height: n }) => (r) => I`
      overflow: hidden;
      position: absolute;
      z-index: 0;
      box-sizing: content-box;
      border-radius: inherit;
      opacity: ${r.opacity[0]};
      background-color: ${yn(r, e)};
      transition:
        opacity 0.15s ease,
        transform 0.15s ease;
      transform-origin: center;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);

      ${t !== void 0 && I`
          width: ${k(t)};
        `}
      ${n !== void 0 && I`
          height: ${k(n)};
        `}
    `, fr = ({ disabled: e, variant: t, scale: n }) => (r) => I`
      position: relative;
      -webkit-tap-highlight-color: transparent;

      &:focus-visible {
        outline-style: solid;
        outline-width: 2px;
      }

      ${!e && I`
          &:hover > [data-component='with-interaction'] {
            ${pr(r, t)}
          }

          @media not (pointer: fine) {
            &:hover > [data-component='with-interaction'] {
              opacity: ${r.opacity[0]};
            }
          }

          &:focus-visible > [data-component='with-interaction'] {
            opacity: ${r.opacity[0]};
          }
          &:active > [data-component='with-interaction'] {
            ${mr(r, t)}
          }

          ${n && I`
              & > [data-component='with-interaction'] {
                transform: translate(-50%, -50%) scale(0.95);
              }

              &:hover > [data-component='with-interaction'] {
                transform: translate(-50%, -50%) scale(1);
              }

              @media not (pointer: fine) {
                &:hover > [data-component='with-interaction'] {
                  transform: translate(-50%, -50%) scale(0.95);
                }
              }

              &:active > [data-component='with-interaction'] {
                transform: translate(-50%, -50%) scale(1);
              }

              &:focus-visible > [data-component='with-interaction'] {
                transform: translate(-50%, -50%) scale(0.95);
              }
            `}
        `}
    `, pr = (e, t = "normal") => {
	switch (t) {
		case "normal": return I`
        opacity: ${e.opacity[5]};
      `;
		case "light": return I`
        opacity: ${.0375};
      `;
		case "strong": return I`
        opacity: ${.075};
      `;
	}
}, mr = (e, t = "normal") => {
	switch (t) {
		case "normal": return I`
        opacity: ${e.opacity[12]};
      `;
		case "light": return I`
        opacity: ${.09};
      `;
		case "strong": return I`
        opacity: ${.18};
      `;
	}
}, hr = (0, _.forwardRef)(({ variant: e = "normal", children: t, scale: n, disabled: r, color: i, width: a, height: o, sx: s, ...c }, l) => {
	if ((0, _.isValidElement)(t)) {
		let u = { ...t.props }, d = l ? re(l, t.ref ?? u.ref) : void 0;
		return u.children = /* @__PURE__ */ (0, O.jsxs)(O.Fragment, { children: [u.children, /* @__PURE__ */ (0, O.jsx)(gr, {
			color: i,
			height: o,
			width: a
		})] }), /* @__PURE__ */ (0, O.jsx)(V, {
			as: ce,
			...c,
			sx: [
				fr({
					disabled: r,
					variant: e,
					scale: n
				}),
				s,
				u.sx
			],
			children: (0, _.cloneElement)(t, {
				...u,
				sx: void 0,
				ref: d,
				children: u.children
			})
		});
	}
	return _.Children.count(t) > 1 ? _.Children.only(null) : null;
});
hr.displayName = "WithInteraction";
var gr = ({ color: e = "semantic.foreground.neutral.primary", width: t = "100%", height: n = "100%" }) => /* @__PURE__ */ (0, O.jsx)(V, {
	"data-component": "with-interaction",
	role: "presentation",
	sx: dr({
		color: e,
		width: t,
		height: n
	})
}), _r = function(e) {
	return typeof document > "u" ? null : (Array.isArray(e) ? e[0] : e).ownerDocument.body;
}, vr = /* @__PURE__ */ new WeakMap(), yr = /* @__PURE__ */ new WeakMap(), br = {}, xr = 0, Sr = function(e) {
	return e && (e.host || Sr(e.parentNode));
}, Cr = function(e, t) {
	return t.map(function(t) {
		if (e.contains(t)) return t;
		var n = Sr(t);
		return n && e.contains(n) ? n : (console.error("aria-hidden", t, "in not contained inside", e, ". Doing nothing"), null);
	}).filter(function(e) {
		return !!e;
	});
}, wr = function(e, t, n, r) {
	var i = Cr(t, Array.isArray(e) ? e : [e]);
	br[n] || (br[n] = /* @__PURE__ */ new WeakMap());
	var a = br[n], o = [], s = /* @__PURE__ */ new Set(), c = new Set(i), l = function(e) {
		e && !s.has(e) && (s.add(e), l(e.parentNode));
	};
	i.forEach(l);
	var u = function(e) {
		e && !c.has(e) && Array.prototype.forEach.call(e.children, function(e) {
			if (s.has(e)) u(e);
			else try {
				var t = e.getAttribute(r), i = t !== null && t !== "false", c = (vr.get(e) || 0) + 1, l = (a.get(e) || 0) + 1;
				vr.set(e, c), a.set(e, l), o.push(e), c === 1 && i && yr.set(e, !0), l === 1 && e.setAttribute(n, "true"), i || e.setAttribute(r, "true");
			} catch (t) {
				console.error("aria-hidden: cannot operate on ", e, t);
			}
		});
	};
	return u(t), s.clear(), xr++, function() {
		o.forEach(function(e) {
			var t = vr.get(e) - 1, i = a.get(e) - 1;
			vr.set(e, t), a.set(e, i), t || (yr.has(e) || e.removeAttribute(r), yr.delete(e)), i || e.removeAttribute(n);
		}), xr--, xr || (vr = /* @__PURE__ */ new WeakMap(), vr = /* @__PURE__ */ new WeakMap(), yr = /* @__PURE__ */ new WeakMap(), br = {});
	};
}, Tr = function(e, t, n) {
	n === void 0 && (n = "data-aria-hidden");
	var r = Array.from(Array.isArray(e) ? e : [e]), i = t || _r(e);
	return i ? (r.push.apply(r, Array.from(i.querySelectorAll("[aria-live], script"))), wr(r, i, n, "aria-hidden")) : function() {
		return null;
	};
}, Er = (e, t) => `rgba(${e.startsWith("var(") ? e.replace(")", "-rgb)") : Dr(e)}, ${t})`, Dr = (e) => {
	let t = e.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (e, t, n, r) => t + t + n + n + r + r), n = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(t);
	return n && n.length > 2 ? `${parseInt(n[1] || "", 16)}, ${parseInt(n[2] || "", 16)}, ${parseInt(n[3] || "", 16)}` : null;
}, Or = (e, t) => {
	if (!e || !t) return t ?? e;
	let n = { ...e.IconButton };
	for (let [e, r] of Object.entries(t.IconButton ?? {})) {
		let t = e;
		n[t] = {
			...n[t],
			...r
		};
	}
	return {
		...e,
		...t,
		IconButton: n
	};
}, kr = (0, _.createContext)({}), Ar = ({ value: e, children: t }) => {
	let n = (0, _.useContext)(kr);
	return e ? /* @__PURE__ */ (0, O.jsx)(kr.Provider, {
		value: Or(n, e),
		children: t
	}) : /* @__PURE__ */ (0, O.jsx)(O.Fragment, { children: t });
}, jr = {}, Mr = ({ children: e }) => /* @__PURE__ */ (0, O.jsx)(kr.Provider, {
	value: jr,
	children: e
}), Nr = () => (0, _.useContext)(kr), Pr = (e, t, n) => {
	let r = Nr()[e], i = $n({
		base: t,
		responsive: n
	}, r && {
		base: r.size,
		responsive: r.responsive
	}, "size");
	return {
		size: i.base,
		responsive: i.responsive
	};
}, Fr = (e, t) => {
	let n = (0, _.createContext)(t), r = (e) => {
		let { children: t, ...r } = e, i = (0, _.useMemo)(() => r, Object.values(r));
		return /* @__PURE__ */ (0, O.jsx)(n.Provider, {
			value: i,
			children: t
		});
	};
	return r.displayName = e + "Provider", [r, () => {
		let e = (0, _.useContext)(n);
		if (e) return e;
		if (t !== void 0) return t;
	}];
};
// node_modules/@radix-ui/react-context/dist/index.mjs
function Ir(e, t) {
	let n = _.createContext(t);
	n.displayName = e + "Context";
	let r = (e) => {
		let { children: t, ...r } = e, i = _.useMemo(() => r, Object.values(r));
		return /* @__PURE__ */ (0, O.jsx)(n.Provider, {
			value: i,
			children: t
		});
	};
	r.displayName = e + "Provider";
	function i(r) {
		let i = _.useContext(n);
		if (i) return i;
		if (t !== void 0) return t;
		throw Error(`\`${r}\` must be used within \`${e}\``);
	}
	return [r, i];
}
// node_modules/@montage-ui/core/dist/components/text-button/contexts.mjs
var [Lr, Rr] = Fr("AnyComponent"), zr = (0, _.forwardRef)((e, t) => /* @__PURE__ */ (0, O.jsx)(V, {
	as: "svg",
	viewBox: "0 0 24 24",
	fill: "none",
	xmlns: "http://www.w3.org/2000/svg",
	width: "1em",
	height: "1em",
	ref: t,
	...e,
	children: /* @__PURE__ */ (0, O.jsx)("path", {
		d: "M2.10004 11.9996C2.10004 6.53199 6.5324 2.09961 12 2.09961C17.4676 2.09961 21.9 6.53199 21.9 11.9996C21.9 17.4672 17.4676 21.8996 12 21.8996C6.5324 21.8996 2.10004 17.4672 2.10004 11.9996ZM16.6467 9.87545C16.9924 9.51829 16.9831 8.94852 16.6259 8.60283C16.2688 8.25713 15.699 8.26642 15.3533 8.62357L10.6774 13.4545L8.64757 11.3517C8.30236 10.9941 7.73261 10.984 7.37498 11.3292C7.01736 11.6745 7.0073 12.2442 7.3525 12.6018L10.029 15.3746C10.1984 15.5501 10.4319 15.6493 10.6759 15.6495C10.9199 15.6497 11.1535 15.5508 11.3232 15.3754L16.6467 9.87545Z",
		fillRule: "evenodd",
		clipRule: "evenodd",
		fill: "currentColor"
	})
})), Br = (0, _.forwardRef)((e, t) => /* @__PURE__ */ (0, O.jsx)(V, {
	as: "svg",
	viewBox: "0 0 24 24",
	fill: "none",
	xmlns: "http://www.w3.org/2000/svg",
	width: "1em",
	height: "1em",
	ref: t,
	...e,
	children: /* @__PURE__ */ (0, O.jsx)("path", {
		d: "M2.10004 11.9996C2.10004 6.53199 6.5324 2.09961 12 2.09961C17.4676 2.09961 21.9 6.53199 21.9 11.9996C21.9 17.4672 17.4676 21.8996 12 21.8996C6.5324 21.8996 2.10004 17.4672 2.10004 11.9996ZM9.1364 7.86324C8.78493 7.51177 8.21508 7.51177 7.86361 7.86324C7.51214 8.21471 7.51214 8.78456 7.86361 9.13603L10.7272 11.9996L7.86361 14.8632C7.51214 15.2147 7.51214 15.7846 7.86361 16.136C8.21508 16.4875 8.78493 16.4875 9.1364 16.136L12 13.2724L14.8636 16.136C15.2151 16.4875 15.7849 16.4875 16.1364 16.136C16.4878 15.7846 16.4878 15.2147 16.1364 14.8632L13.2728 11.9996L16.1364 9.13603C16.4878 8.78456 16.4878 8.21471 16.1364 7.86324C15.7849 7.51177 15.2151 7.51177 14.8636 7.86324L12 10.7268L9.1364 7.86324Z",
		fillRule: "evenodd",
		clipRule: "evenodd",
		fill: "currentColor"
	})
})), Vr = (0, _.forwardRef)((e, t) => /* @__PURE__ */ (0, O.jsx)(V, {
	as: "svg",
	viewBox: "0 0 24 24",
	fill: "none",
	xmlns: "http://www.w3.org/2000/svg",
	width: "1em",
	height: "1em",
	ref: t,
	...e,
	children: /* @__PURE__ */ (0, O.jsx)("path", {
		d: "M4.8637 4.86346C5.21517 4.51199 5.78502 4.51199 6.13649 4.86346L12.0001 10.7271L17.8637 4.86346C18.2151 4.51199 18.785 4.51199 19.1364 4.86346C19.4879 5.21493 19.4879 5.78478 19.1365 6.13625L13.2729 11.9999L19.1365 17.8635C19.4879 18.2149 19.4879 18.7848 19.1364 19.1363C18.785 19.4877 18.2151 19.4877 17.8637 19.1363L12.0001 13.2727L6.13649 19.1363C5.78502 19.4877 5.21517 19.4877 4.8637 19.1363C4.51223 18.7848 4.51223 18.2149 4.8637 17.8635L10.7273 11.9999L4.8637 6.13625C4.51223 5.78478 4.51223 5.21493 4.8637 4.86346Z",
		fill: "currentColor"
	})
})), Hr = (0, _.forwardRef)((e, t) => /* @__PURE__ */ (0, O.jsx)(V, {
	as: "svg",
	viewBox: "0 0 24 24",
	fill: "none",
	xmlns: "http://www.w3.org/2000/svg",
	width: "1em",
	height: "1em",
	ref: t,
	...e,
	children: /* @__PURE__ */ (0, O.jsx)("path", {
		d: "M10.8203 3.10033C11.5711 2.76604 12.4285 2.76604 13.1793 3.10033C13.7027 3.33333 14.0805 3.76043 14.4088 4.22516C14.7343 4.68589 15.0924 5.30622 15.5282 6.06096L20.639 14.9133C21.0748 15.668 21.4329 16.2883 21.6692 16.8006C21.9075 17.3173 22.0885 17.858 22.0286 18.4277C21.9427 19.2451 21.514 19.9877 20.8491 20.4708C20.3856 20.8075 19.8268 20.9211 19.2602 20.9731C18.6984 21.0246 17.9821 21.0246 17.1106 21.0246H6.88896C6.01747 21.0246 5.30117 21.0246 4.73942 20.9731C4.17278 20.9211 3.614 20.8075 3.15055 20.4708C2.48563 19.9877 2.05693 19.2451 1.97102 18.4277C1.91114 17.858 2.09211 17.3173 2.33041 16.8006C2.56666 16.2883 2.92482 15.668 3.36057 14.9132L8.47142 6.06097C8.90715 5.30622 9.26529 4.68589 9.5908 4.22516C9.91914 3.76043 10.2969 3.33333 10.8203 3.10033ZM12 8.09961C12.497 8.09961 12.9 8.50255 12.9 8.99961V12.9996C12.9 13.4967 12.497 13.8996 12 13.8996C11.5029 13.8996 11.1 13.4967 11.1 12.9996V8.99961C11.1 8.50255 11.5029 8.09961 12 8.09961ZM12.9998 16.4996C12.9998 17.0519 12.5521 17.4996 11.9998 17.4996C11.4476 17.4996 10.9998 17.0519 10.9998 16.4996C10.9998 15.9473 11.4476 15.4996 11.9998 15.4996C12.5521 15.4996 12.9998 15.9473 12.9998 16.4996Z",
		fillRule: "evenodd",
		clipRule: "evenodd",
		fill: "currentColor"
	})
})), Ur = Object.defineProperty, Wr = (e, t) => Ur(e, "name", {
	value: t,
	configurable: !0
}), Gr = !!(typeof window < "u" && window.document && window.document.createElement);
function Kr(e, t, { checkForDefaultPrevented: n = !0 } = {}) {
	return /* @__PURE__ */ Wr(function(r) {
		if (e?.(r), n === !1 || !r || !r.defaultPrevented) return t?.(r);
	}, "handleEvent");
}
Wr(Kr, "composeEventHandlers");
function qr(e) {
	if (!Gr) throw Error("Cannot access window outside of the DOM");
	return e?.ownerDocument?.defaultView ?? window;
}
Wr(qr, "getOwnerWindow");
function Jr(e) {
	if (!Gr) throw Error("Cannot access document outside of the DOM");
	return e?.ownerDocument ?? document;
}
Wr(Jr, "getOwnerDocument");
function Yr(e, t = !1) {
	let { activeElement: n } = Jr(e);
	if (!n?.nodeName) return null;
	if (Xr(n) && n.contentDocument) return Yr(n.contentDocument.body, t);
	if (t) {
		let e = n.getAttribute("aria-activedescendant");
		if (e) {
			let t = Jr(n).getElementById(e);
			if (t) return t;
		}
	}
	return n;
}
Wr(Yr, "getActiveElement");
function Xr(e) {
	return e.tagName === "IFRAME";
}
Wr(Xr, "isFrame");
// node_modules/@radix-ui/react-use-effect-event/dist/index.mjs
var Zr = Object.defineProperty, Qr = (e, t) => Zr(e, "name", {
	value: t,
	configurable: !0
}), $r = _.useEffectEvent, ei = _.useInsertionEffect;
function ti(e) {
	if (typeof $r == "function") return $r(e);
	let t = _.useRef(() => {
		throw Error("Cannot call an event handler while rendering.");
	});
	return typeof ei == "function" ? ei(() => {
		t.current = e;
	}) : v(() => {
		t.current = e;
	}), _.useMemo(() => ((...e) => t.current?.(...e)), []);
}
Qr(ti, "useEffectEvent");
// node_modules/@radix-ui/react-use-controllable-state/dist/index.mjs
var ni = Object.defineProperty, ri = (e, t) => ni(e, "name", {
	value: t,
	configurable: !0
}), ii = _.useInsertionEffect || v;
function ai({ prop: e, defaultProp: t, onChange: n = /* @__PURE__ */ ri(() => {}, "onChange"), caller: r }) {
	let [i, a, o] = oi({
		defaultProp: t,
		onChange: n
	}), s = e !== void 0;
	return [s ? e : i, _.useCallback((t) => {
		if (s) {
			let n = si(t) ? t(e) : t;
			n !== e && o.current?.(n);
		} else a(t);
	}, [
		s,
		e,
		a,
		o
	])];
}
ri(ai, "useControllableState");
function oi({ defaultProp: e, onChange: t }) {
	let [n, r] = _.useState(e), i = _.useRef(n), a = _.useRef(t);
	return ii(() => {
		a.current = t;
	}, [t]), _.useEffect(() => {
		i.current !== n && (a.current?.(n), i.current = n);
	}, [n, i]), [
		n,
		r,
		a
	];
}
ri(oi, "useUncontrolledState");
function si(e) {
	return typeof e == "function";
}
ri(si, "isFunction");
var ci = Symbol("RADIX:SYNC_STATE");
function li(e, t, n, r) {
	let { prop: i, defaultProp: a, onChange: o, caller: s } = t, c = i !== void 0, l = ti(o), u = [{
		...n,
		state: a
	}];
	r && u.push(r);
	let [d, f] = _.useReducer((t, n) => {
		if (n.type === ci) return {
			...t,
			state: n.state
		};
		let r = e(t, n);
		return c && !Object.is(r.state, t.state) && l(r.state), r;
	}, ...u), p = d.state, m = _.useRef(p);
	_.useEffect(() => {
		m.current !== p && (m.current = p, c || l(p));
	}, [
		p,
		m,
		c
	]);
	let h = _.useMemo(() => i === void 0 ? d : {
		...d,
		state: i
	}, [d, i]);
	return _.useEffect(() => {
		c && !Object.is(i, d.state) && f({
			type: ci,
			state: i
		});
	}, [
		i,
		d.state,
		c
	]), [h, f];
}
ri(li, "useControllableStateReducer");
// node_modules/@montage-ui/core/dist/components/loading/constants.mjs
var ui = "Loading", di = ({ size: e, xl: t, lg: n, md: r, sm: i, xs: a }) => (o) => I`
      width: ${k(e)};
      height: ${k(e)};
      margin: 0 auto;

      ${Yn({
	xl: t,
	lg: n,
	md: r,
	sm: i,
	xs: a
}, o)((e) => I`
          ${e?.size !== void 0 && I`
              width: ${k(e.size)};
              height: ${k(e.size)};
            `}
          ${e?.sx}
        `)}
    `, fi = (e) => I`
  @keyframes array {
    0%,
    25%,
    50%,
    75%,
    100% {
      stroke-dasharray: 0 78.5398163397;
    }

    12.5%,
    37.5%,
    62.5%,
    87.5% {
      stroke-dasharray: 58.9048622548 19.6349540849;
    }
  }

  @keyframes offset {
    0%,
    12.5% {
      stroke-dashoffset: 0;
    }

    25%,
    37.5% {
      stroke-dashoffset: -58.9048622548;
    }

    50%,
    62.5% {
      stroke-dashoffset: -117.8097245096;
    }

    75%,
    87.5% {
      stroke-dashoffset: -176.7145867644;
    }

    100% {
      stroke-dashoffset: -235.6195;
    }
  }

  @keyframes rotate {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  circle {
    fill: none;
    stroke: ${e.semantic.line.neutral.primaryOpaque};
    stroke-width: 3;
    stroke-linecap: round;
    transform-origin: center center;
    animation:
      array 5.3333s ease infinite,
      offset 5.3333s ease infinite,
      rotate 2.2s linear infinite;
  }
`, pi = (e) => I`
  --time: 0.9;
  --color-alias-accent-pink: ${e.atomic.pink[60]};
  --color-alias-accent-redOrange: ${e.atomic.redOrange[50]};

  @media (prefers-color-scheme: dark) {
    --color-alias-accent-pink: ${e.atomic.pink[70]};
    --color-alias-accent-redOrange: ${e.atomic.redOrange[60]};
  }

  width: 100%;
  height: 100%;
  fill: ${e.semantic.foreground.brand.primary};
  animation: animation-circular-color calc(var(--time) * 4s)
    calc(var(--time) * 0.5s) linear infinite;

  &,
  * {
    transform-origin: center;
  }

  g {
    animation:
      animation-circular-start calc(var(--time) * 0.5s)
        cubic-bezier(0.5, 0, 0.5, 1),
      animation-circular-rotate calc(var(--time) * 2s) linear infinite;
  }

  g path {
    animation: animation-circular-bounce calc(var(--time) * 3s)
      cubic-bezier(0.8, 0, 0.2, 1) infinite;
    transform: scale(0);
  }

  g path.circle {
    animation:
      animation-circular-bounce calc(var(--time) * 3s)
        cubic-bezier(0.5, 0, 0.5, 1),
      animation-circular-bounce calc(var(--time) * 3s) calc(var(--time) * 3s)
        cubic-bezier(0.8, 0, 0.2, 1) infinite;
  }

  g path.triangle {
    animation-delay: calc(var(--time) * 1s);
  }

  g path.square {
    animation-delay: calc(var(--time) * 2s);
  }

  @keyframes animation-circular-start {
    0% {
      opacity: 0;
    }
    100% {
      opacity: 1;
    }
  }

  @keyframes animation-circular-color {
    0%,
    100% {
      fill: ${e.semantic.foreground.brand.primary};
    }
    25%,
    75% {
      fill: var(--color-alias-accent-pink);
    }
    50% {
      fill: var(--color-alias-accent-redOrange);
    }
  }

  @keyframes animation-circular-rotate {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  @keyframes animation-circular-bounce {
    0%,
    66.6666666667%,
    100% {
      transform: scale(0);
    }
    33.3333333333% {
      transform: scale(1);
    }
  }
`, mi = (0, _.forwardRef)(({ variant: e = "wanted", size: t = "32px", xl: n, lg: r, md: i, sm: a, xs: o, sx: s, ...c }, l) => {
	let u = () => {
		switch (e) {
			case "wanted": return /* @__PURE__ */ (0, O.jsx)(hi, {});
			case "circular": return /* @__PURE__ */ (0, O.jsx)(gi, {});
		}
	};
	return /* @__PURE__ */ (0, O.jsx)(nr, {
		ref: l,
		...c,
		sx: [di({
			size: t,
			xl: n,
			lg: r,
			md: i,
			sm: a,
			xs: o
		}), s],
		children: u()
	});
});
mi.displayName = ui;
var hi = () => /* @__PURE__ */ (0, O.jsx)(V, {
	as: "svg",
	viewBox: "0 0 24 24",
	xmlns: "http://www.w3.org/2000/svg",
	sx: pi,
	children: /* @__PURE__ */ (0, O.jsxs)("g", { children: [
		/* @__PURE__ */ (0, O.jsx)("path", {
			className: "circle",
			d: "M2.09998 12.0001C2.09998 6.53248 6.53236 2.1001 12 2.1001C17.4676 2.1001 21.9 6.53248 21.9 12.0001C21.9 17.4677 17.4676 21.9001 12 21.9001C6.53236 21.9001 2.09998 17.4677 2.09998 12.0001Z"
		}),
		/* @__PURE__ */ (0, O.jsx)("path", {
			className: "triangle",
			d: "M8.53604 5C9.67283 3.03102 10.2412 2.04653 10.9833 1.71614C11.6306 1.42795 12.3697 1.42795 13.017 1.71614C13.7591 2.04653 14.3274 3.03102 15.4642 5L19.7944 12.5C20.9312 14.469 21.4996 15.4535 21.4146 16.2613C21.3406 16.966 20.971 17.6061 20.3978 18.0225C19.7406 18.5 18.6039 18.5 16.3303 18.5H7.67001C5.39643 18.5 4.25964 18.5 3.60247 18.0225C3.02927 17.6061 2.65969 16.966 2.58563 16.2613C2.50072 15.4535 3.06912 14.469 4.20591 12.5L8.53604 5Z"
		}),
		/* @__PURE__ */ (0, O.jsx)("path", {
			className: "square",
			d: "M8.55001 2.85001H8.51231C7.70426 2.85 7.0434 2.84999 6.50633 2.89387C5.95041 2.93929 5.44833 3.03617 4.97944 3.27508C4.24561 3.64899 3.64899 4.24561 3.27508 4.97944C3.03617 5.44833 2.93929 5.95041 2.89387 6.50632C2.84999 7.04339 2.85 7.70422 2.85001 8.51224V8.55001V15.45V15.4877C2.85 16.2957 2.84999 16.9566 2.89387 17.4937C2.93929 18.0496 3.03617 18.5517 3.27508 19.0206C3.64899 19.7544 4.24561 20.351 4.97944 20.7249C5.44833 20.9638 5.95041 21.0607 6.50633 21.1061C7.0434 21.15 7.70425 21.15 8.5123 21.15H8.55001H15.45H15.4877C16.2958 21.15 16.9566 21.15 17.4937 21.1061C18.0496 21.0607 18.5517 20.9638 19.0206 20.7249C19.7544 20.351 20.351 19.7544 20.7249 19.0206C20.9638 18.5517 21.0607 18.0496 21.1061 17.4937C21.15 16.9566 21.15 16.2958 21.15 15.4877V15.45V8.55001V8.5123C21.15 7.70425 21.15 7.0434 21.1061 6.50632C21.0607 5.95041 20.9638 5.44833 20.7249 4.97944C20.351 4.24561 19.7544 3.64899 19.0206 3.27508C18.5517 3.03617 18.0496 2.93929 17.4937 2.89387C16.9566 2.84999 16.2958 2.85 15.4877 2.85001H15.45H8.55001Z"
		})
	] })
}), gi = () => /* @__PURE__ */ (0, O.jsx)(V, {
	as: "svg",
	viewBox: "0 0 28 28",
	xmlns: "http://www.w3.org/2000/svg",
	sx: fi,
	children: /* @__PURE__ */ (0, O.jsx)("circle", {
		cx: "14",
		cy: "14",
		r: "12.5"
	})
}), _i = ({ loading: e, xs: t, sm: n, md: r, lg: i, xl: a, ...o }) => (s) => I`
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      box-sizing: border-box;
      line-height: initial;
      white-space: nowrap;
      height: fit-content;
      position: relative;
      cursor: pointer;

      & > svg {
        flex-shrink: 0;
      }

      [data-role='button-loading'] {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        circle {
          stroke: currentColor;
        }
      }

      ${e && I`
          cursor: wait;
          &
            > *:not([data-role='button-loading']):not(
              [data-component='with-interaction']
            ) {
            visibility: hidden;
          }
        `}

      &:disabled,
      &[aria-disabled='true'] {
        pointer-events: none;
        cursor: initial;
      }

      ${yi(o, s)}
      ${vi(o, s)}
      ${o.fullWidth ? "width: 100%;" : "width: fit-content;"}

      ${Yn({
	xs: t,
	sm: n,
	md: r,
	lg: i,
	xl: a
}, s)((e) => I`
          ${vi({
	...e,
	color: o.color
}, s)}
          ${e?.fullWidth && "width: 100%;"}
          ${e?.fullWidth === !1 && "width: fit-content;"}
          ${e?.sx}
        `)}
    `, vi = ({ size: e, iconOnly: t } = {}, n) => {
	switch (e) {
		case "large": return I`
        border-radius: ${n.radius[14]};
        min-height: ${n.dimension[48]};
        padding: 13px ${n.spacing[20]};
        gap: ${n.spacing[6]};

        [data-role='button-loading'] {
          width: ${n.dimension[16]};
          height: ${n.dimension[16]};
        }

        ${t ? I`
                padding: ${n.spacing[14]};
                font-size: 20px;

                svg {
                  flex-shrink: 0;
                }
              ` : I`
                & > svg {
                  font-size: 20px;
                }
                & > span {
                  ${cr("body2", "bold")}
                }
              `}
      `;
		case "medium": return I`
        border-radius: ${n.radius[12]};
        min-height: ${n.dimension[40]};
        padding: ${n.spacing[10]} ${n.spacing[16]};
        gap: ${n.spacing[4]};

        [data-role='button-loading'] {
          width: ${n.dimension[14]};
          height: ${n.dimension[14]};
        }

        ${t ? I`
                padding: 11px;
                font-size: 18px;

                svg {
                  flex-shrink: 0;
                }
              ` : I`
                & > svg {
                  font-size: 18px;
                }
                & > span {
                  ${cr("label1", "bold")}
                }
              `}
      `;
		case "small": return I`
        border-radius: ${n.radius[10]};
        min-height: ${n.dimension[32]};
        padding: ${n.spacing[8]} ${n.spacing[12]};
        gap: ${n.spacing[4]};

        [data-role='button-loading'] {
          width: ${n.dimension[12]};
          height: ${n.dimension[12]};
        }

        ${t ? I`
                padding: ${n.spacing[8]};
                font-size: 16px;

                svg {
                  flex-shrink: 0;
                }
              ` : I`
                & > svg {
                  font-size: 16px;
                }
                & > span {
                  ${cr("caption1", "bold")}
                }
              `}
      `;
		case "xsmall": return I`
        border-radius: ${n.radius[8]};
        min-height: ${n.dimension[28]};
        padding: ${n.spacing[6]} ${n.spacing[10]};
        gap: ${n.spacing[4]};

        [data-role='button-loading'] {
          width: ${n.dimension[12]};
          height: ${n.dimension[12]};
        }

        ${t ? I`
                padding: 7px;
                font-size: 14px;

                svg {
                  flex-shrink: 0;
                }
              ` : I`
                & > svg {
                  font-size: 14px;
                }
                & > span {
                  ${cr("caption1", "bold")}
                }
              `}
      `;
	}
}, yi = ({ variant: e, color: t } = {}, n) => {
	switch (!0) {
		case e === "solid" && t === "primary": return I`
        color: ${n.semantic.static.white};
        background-color: ${n.semantic.surface.brand.primary};
        box-shadow: none;

        [data-role='button-loading'] {
          color: inherit;
        }

        &:disabled,
        &[aria-disabled='true'] {
          color: ${n.semantic.foreground.disable.primary};
          background-color: ${n.semantic.surface.disable.primary};
          box-shadow: none;
        }
      `;
		case e === "solid" && t === "assistive": return I`
        color: ${n.semantic.foreground.neutral.secondary};
        background-color: ${n.semantic.surface.neutral.secondary};
        box-shadow: none;
        backdrop-filter: blur(32px);

        [data-role='button-loading'] {
          color: inherit;
        }

        &:disabled,
        &[aria-disabled='true'] {
          color: ${n.semantic.foreground.disable.primary};
          background-color: ${n.semantic.surface.disable.primary};
          box-shadow: none;
          backdrop-filter: none;
        }
      `;
		case e === "solid" && t === "negative": return I`
        color: ${n.semantic.foreground.negative.strong};
        background-color: ${n.semantic.surface.negative.strong};
        box-shadow: none;

        [data-role='button-loading'] {
          color: inherit;
        }

        &:disabled,
        &[aria-disabled='true'] {
          color: ${n.semantic.foreground.disable.primary};
          background-color: ${n.semantic.surface.disable.primary};
          box-shadow: none;
        }
      `;
		case e === "outlined" && t === "primary": return I`
        color: ${n.semantic.foreground.brand.primary};
        background-color: transparent;
        box-shadow: inset 0 0 0 1px ${n.semantic.line.neutral.secondary};

        [data-role='button-loading'] {
          color: inherit;
        }

        &:disabled,
        &[aria-disabled='true'] {
          color: ${n.semantic.foreground.disable.primary};
          background-color: transparent;
          box-shadow: inset 0 0 0 1px ${n.semantic.line.neutral.secondary};
        }
      `;
		case e === "outlined" && t === "assistive": return I`
        color: ${n.semantic.foreground.neutral.primary};
        background-color: transparent;
        box-shadow: inset 0 0 0 1px ${n.semantic.line.neutral.secondary};

        [data-role='button-loading'] {
          color: inherit;
        }

        &:disabled,
        &[aria-disabled='true'] {
          color: ${n.semantic.foreground.disable.primary};
          background-color: transparent;
          box-shadow: inset 0 0 0 1px ${n.semantic.line.neutral.secondary};
        }
      `;
	}
}, bi = (0, _.forwardRef)(({ as: e, variant: t = "solid", disabled: n = !1, disableInteraction: r = !1, fullWidth: i = !1, color: a = "primary", loading: o = !1, iconOnly: s, leadingContent: c, trailingContent: l, size: u, disableLoadingPreventEvents: d, children: f, xs: p, sm: m, md: h, lg: g, xl: v, ...y }, b) => {
	let { size: x, responsive: S } = Pr("Button", u, {
		xs: p,
		sm: m,
		md: h,
		lg: g,
		xl: v
	}), C = x ?? "medium", ee = (0, _.useId)(), w = t === "outlined" && a === "negative" ? "primary" : a, te = () => {
		switch (t) {
			case "outlined": return "light";
			case "solid": return w === "assistive" ? "normal" : "strong";
		}
	}, T = (e) => {
		o && !d && (e.preventDefault(), e.stopPropagation());
	};
	return /* @__PURE__ */ (0, O.jsx)(hr, {
		color: "semantic.foreground.neutral.primary",
		variant: te(),
		disabled: r || n,
		children: /* @__PURE__ */ (0, O.jsxs)(V, {
			as: e || "button",
			"aria-labelledby": s ? void 0 : ee,
			ref: b,
			disabled: n,
			"aria-disabled": n,
			type: "button",
			...y,
			onClick: Kr(T, y.onClick),
			onMouseDown: Kr(T, y.onMouseDown),
			onPointerDown: Kr(T, y.onPointerDown),
			onKeyDown: Kr((e) => {
				(e.key === "Enter" || e.key === " ") && T(e);
			}, y.onKeyDown),
			sx: [_i({
				variant: t,
				iconOnly: s,
				loading: o,
				size: C,
				fullWidth: i,
				color: w,
				...S
			}), y.sx],
			children: [o && /* @__PURE__ */ (0, O.jsx)(mi, {
				"data-role": "button-loading",
				variant: "circular"
			}), s ? f : /* @__PURE__ */ (0, O.jsxs)(O.Fragment, { children: [
				!!c && c,
				/* @__PURE__ */ (0, O.jsx)("span", {
					id: ee,
					children: f
				}),
				!!l && l
			] })]
		})
	});
});
bi.displayName = "Button";
// node_modules/@montage-ui/core/dist/components/text-button/style.mjs
var xi = ({ loading: e, xs: t, sm: n, md: r, lg: i, xl: a, ...o }) => (s) => I`
      display: inline-flex;
      align-items: center;
      justify-content: center;
      vertical-align: middle;
      box-sizing: border-box;
      line-height: initial;
      white-space: nowrap;
      height: fit-content;
      width: fit-content;
      cursor: pointer;

      [data-role='text-button-loading'] {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        circle {
          stroke: currentColor;
        }
      }

      ${e && I`
          cursor: wait;
          &
            > *:not([data-role='text-button-loading']):not(
              [data-component='with-interaction']
            ) {
            visibility: hidden;
          }
        `}

      &:disabled,
      &[aria-disabled='true'] {
        pointer-events: none;
        cursor: initial;
      }

      ${Si(o, s)}
      ${Ci(o, s)}

      ${Yn({
	xs: t,
	sm: n,
	md: r,
	lg: i,
	xl: a
}, s)((e = {}) => I`
          ${Ci(e, s)}
          ${e.sx}
        `)}
    `, Si = ({ color: e, overrideColor: t }, n) => {
	switch (e) {
		case "primary": return I`
        color: ${t ? yn(n, t) : n.semantic.foreground.brand.primary};
        background-color: transparent;
        border: none;
        box-shadow: none;

        [data-role='text-button-loading'] {
          color: inherit;
        }

        &:disabled,
        &[aria-disabled='true'] {
          color: ${n.semantic.foreground.disable.primary};
        }
      `;
		case "assistive": return I`
        background-color: transparent;
        border: none;
        box-shadow: none;
        color: ${t ? yn(n, t) : n.semantic.foreground.neutral.tertiary};

        [data-role='text-button-loading'] {
          color: ${n.semantic.foreground.neutral.quaternary};
        }

        &:disabled,
        &[aria-disabled='true'] {
          color: ${n.semantic.foreground.disable.primary};
        }
      `;
	}
}, Ci = ({ size: e }, t) => {
	switch (e) {
		case "medium": return I`
        gap: ${t.spacing[4]};
        border-radius: ${t.radius[10]};
        min-height: ${t.dimension[32]};
        padding: 5px ${t.spacing[0]};

        [data-role='text-button-loading'] {
          width: ${t.dimension[14]};
          height: ${t.dimension[14]};
        }

        & > [data-component='with-interaction'] {
          width: calc(100% + (${t.spacing[8]} * 2));
          height: 100%;
        }

        & > svg {
          flex-shrink: 0;
          font-size: ${t.dimension[18]};
        }
        & > span {
          ${cr("body2", "bold")}
        }
      `;
		case "small": return I`
        gap: ${t.spacing[4]};
        border-radius: ${t.radius[8]};
        min-height: ${t.dimension[28]};
        padding: ${t.spacing[4]} ${t.spacing[0]};

        [data-role='text-button-loading'] {
          width: ${t.dimension[12]};
          height: ${t.dimension[12]};
        }

        & > [data-component='with-interaction'] {
          width: calc(100% + (${t.spacing[6]} * 2));
          height: 100%;
        }

        & > svg {
          flex-shrink: 0;
          font-size: ${t.dimension[16]};
        }
        & > span {
          ${cr("label1", "bold")}
        }
      `;
	}
}, wi = (0, _.forwardRef)(({ as: e, disabled: t = !1, disableInteraction: n = !1, color: r = "primary", leadingContent: i, trailingContent: a, size: o, children: s, loading: c = !1, disableLoadingPreventEvents: l, xs: u, sm: d, md: f, lg: p, xl: m, ...h }, g) => {
	let { size: v, responsive: y } = Pr("TextButton", o, {
		xs: u,
		sm: d,
		md: f,
		lg: p,
		xl: m
	}), b = v ?? "medium", x = (0, _.useId)(), S = Rr(), C = r === "primary" ? "semantic.surface.brand.primary" : "semantic.foreground.neutral.primary", ee = (0, _.useMemo)(() => S?.[r], [S, r]), w = (e) => {
		c && !l && (e.preventDefault(), e.stopPropagation());
	};
	return /* @__PURE__ */ (0, O.jsx)(hr, {
		color: C,
		disabled: n || t,
		variant: r === "primary" ? "normal" : "light",
		scale: !0,
		children: /* @__PURE__ */ (0, O.jsxs)(V, {
			as: e || "button",
			"data-component": "text-button",
			"data-color": r,
			"aria-labelledby": x,
			ref: g,
			type: "button",
			disabled: t,
			"aria-disabled": t,
			...h,
			onClick: Kr(w, h.onClick),
			onMouseDown: Kr(w, h.onMouseDown),
			onPointerDown: Kr(w, h.onPointerDown),
			onKeyDown: Kr((e) => {
				(e.key === "Enter" || e.key === " ") && w(e);
			}, h.onKeyDown),
			sx: [xi({
				overrideColor: ee,
				size: b,
				loading: c,
				color: r,
				...y
			}), h.sx],
			children: [
				c && /* @__PURE__ */ (0, O.jsx)(mi, {
					size: "1em",
					variant: "circular",
					"data-role": "text-button-loading"
				}),
				!!i && i,
				/* @__PURE__ */ (0, O.jsx)("span", {
					id: x,
					children: s
				}),
				!!a && a
			]
		})
	});
});
wi.displayName = "TextButton", typeof window < "u" && window.document && window.document.createElement;
function Ti(e, t, { checkForDefaultPrevented: n = !0 } = {}) {
	return function(r) {
		if (e?.(r), n === !1 || !r.defaultPrevented) return t?.(r);
	};
}
// node_modules/@radix-ui/react-dismissable-layer/node_modules/@radix-ui/react-compose-refs/dist/index.mjs
function Ei(e, t) {
	if (typeof e == "function") return e(t);
	e != null && (e.current = t);
}
function Di(...e) {
	return (t) => {
		let n = !1, r = e.map((e) => {
			let r = Ei(e, t);
			return !n && typeof r == "function" && (n = !0), r;
		});
		if (n) return () => {
			for (let t = 0; t < r.length; t++) {
				let n = r[t];
				typeof n == "function" ? n() : Ei(e[t], null);
			}
		};
	};
}
function Oi(...e) {
	return _.useCallback(Di(...e), e);
}
// node_modules/@radix-ui/react-dismissable-layer/node_modules/@radix-ui/react-slot/dist/index.mjs
// @__NO_SIDE_EFFECTS__
function ki(e) {
	let t = _.forwardRef((t, n) => {
		let { children: r, ...i } = t, a = null, o = !1, s = [];
		Ii(r) && typeof Bi == "function" && (r = Bi(r._payload)), _.Children.forEach(r, (e) => {
			if (Pi(e)) {
				o = !0;
				let t = e, n = "child" in t.props ? t.props.child : t.props.children;
				Ii(n) && typeof Bi == "function" && (n = Bi(n._payload)), a = ji(t, n), s.push(a?.props?.children);
			} else s.push(e);
		}), a ? a = _.cloneElement(a, void 0, s) : !o && _.Children.count(r) === 1 && _.isValidElement(r) && (a = r);
		let c = a ? Ni(a) : void 0, l = Oi(n, c);
		if (!a) {
			if (r || r === 0) throw Error(o ? zi(e) : Ri(e));
			return r;
		}
		let u = Mi(i, a.props ?? {});
		return a.type !== _.Fragment && (u.ref = n ? l : c), _.cloneElement(a, u);
	});
	return t.displayName = `${e}.Slot`, t;
}
var Ai = Symbol.for("radix.slottable"), ji = (e, t) => {
	if ("child" in e.props) {
		let t = e.props.child;
		return _.isValidElement(t) ? _.cloneElement(t, void 0, e.props.children(t.props.children)) : null;
	}
	return _.isValidElement(t) ? t : null;
};
function Mi(e, t) {
	let n = { ...t };
	for (let r in t) {
		let i = e[r], a = t[r];
		/^on[A-Z]/.test(r) ? i && a ? n[r] = (...e) => {
			let t = a(...e);
			return i(...e), t;
		} : i && (n[r] = i) : r === "style" ? n[r] = {
			...i,
			...a
		} : r === "className" && (n[r] = [i, a].filter(Boolean).join(" "));
	}
	return {
		...e,
		...n
	};
}
function Ni(e) {
	let t = Object.getOwnPropertyDescriptor(e.props, "ref")?.get, n = t && "isReactWarning" in t && t.isReactWarning;
	return n ? e.ref : (t = Object.getOwnPropertyDescriptor(e, "ref")?.get, n = t && "isReactWarning" in t && t.isReactWarning, n ? e.props.ref : e.props.ref || e.ref);
}
function Pi(e) {
	return _.isValidElement(e) && typeof e.type == "function" && "__radixId" in e.type && e.type.__radixId === Ai;
}
var Fi = Symbol.for("react.lazy");
function Ii(e) {
	return typeof e == "object" && !!e && "$$typeof" in e && e.$$typeof === Fi && "_payload" in e && Li(e._payload);
}
function Li(e) {
	return typeof e == "object" && !!e && "then" in e;
}
var Ri = (e) => `${e} failed to slot onto its children. Expected a single React element child or \`Slottable\`.`, zi = (e) => `${e} failed to slot onto its \`Slottable\`. Expected \`Slottable\` to receive a single React element child.`, Bi = _.use, Vi = [
	"a",
	"button",
	"div",
	"form",
	"h2",
	"h3",
	"img",
	"input",
	"label",
	"li",
	"nav",
	"ol",
	"p",
	"select",
	"span",
	"svg",
	"ul"
].reduce((e, t) => {
	let n = /* @__PURE__ */ ki(`Primitive.${t}`), r = _.forwardRef((e, r) => {
		let { asChild: i, ...a } = e, o = i ? n : t;
		return typeof window < "u" && (window[Symbol.for("radix-ui")] = !0), /* @__PURE__ */ (0, O.jsx)(o, {
			...a,
			ref: r
		});
	});
	return r.displayName = `Primitive.${t}`, {
		...e,
		[t]: r
	};
}, {});
function Hi(e, t) {
	e && D.flushSync(() => e.dispatchEvent(t));
}
// node_modules/@radix-ui/react-dismissable-layer/node_modules/@radix-ui/react-use-callback-ref/dist/index.mjs
function Ui(e) {
	let t = _.useRef(e);
	return _.useEffect(() => {
		t.current = e;
	}), _.useMemo(() => ((...e) => t.current?.(...e)), []);
}
// node_modules/@radix-ui/react-use-escape-keydown/node_modules/@radix-ui/react-use-callback-ref/dist/index.mjs
function Wi(e) {
	let t = _.useRef(e);
	return _.useEffect(() => {
		t.current = e;
	}), _.useMemo(() => ((...e) => t.current?.(...e)), []);
}
// node_modules/@radix-ui/react-use-escape-keydown/dist/index.mjs
function Gi(e, t = globalThis?.document) {
	let n = Wi(e);
	_.useEffect(() => {
		let e = (e) => {
			e.key === "Escape" && n(e);
		};
		return t.addEventListener("keydown", e, { capture: !0 }), () => t.removeEventListener("keydown", e, { capture: !0 });
	}, [n, t]);
}
// node_modules/@radix-ui/react-dismissable-layer/dist/index.mjs
var Ki = "DismissableLayer", qi = "dismissableLayer.update", Ji = "dismissableLayer.pointerDownOutside", Yi = "dismissableLayer.focusOutside", Xi, Zi = _.createContext({
	layers: /* @__PURE__ */ new Set(),
	layersWithOutsidePointerEventsDisabled: /* @__PURE__ */ new Set(),
	branches: /* @__PURE__ */ new Set()
}), Qi = _.forwardRef((e, t) => {
	let { disableOutsidePointerEvents: n = !1, onEscapeKeyDown: r, onPointerDownOutside: i, onFocusOutside: a, onInteractOutside: o, onDismiss: s, ...c } = e, l = _.useContext(Zi), [u, d] = _.useState(null), f = u?.ownerDocument ?? globalThis?.document, [, p] = _.useState({}), m = Oi(t, (e) => d(e)), h = Array.from(l.layers), [g] = [...l.layersWithOutsidePointerEventsDisabled].slice(-1), v = h.indexOf(g), y = u ? h.indexOf(u) : -1, b = l.layersWithOutsidePointerEventsDisabled.size > 0, x = y >= v, S = ta((e) => {
		let t = e.target, n = [...l.branches].some((e) => e.contains(t));
		x && !n && (i?.(e), o?.(e), e.defaultPrevented || s?.());
	}, f), C = H((e) => {
		let t = e.target;
		[...l.branches].some((e) => e.contains(t)) || (a?.(e), o?.(e), e.defaultPrevented || s?.());
	}, f);
	return Gi((e) => {
		y === l.layers.size - 1 && (r?.(e), !e.defaultPrevented && s && (e.preventDefault(), s()));
	}, f), _.useEffect(() => {
		if (u) return n && (l.layersWithOutsidePointerEventsDisabled.size === 0 && (Xi = f.body.style.pointerEvents, f.body.style.pointerEvents = "none"), l.layersWithOutsidePointerEventsDisabled.add(u)), l.layers.add(u), U(), () => {
			n && (l.layersWithOutsidePointerEventsDisabled.delete(u), l.layersWithOutsidePointerEventsDisabled.size === 0 && (f.body.style.pointerEvents = Xi));
		};
	}, [
		u,
		f,
		n,
		l
	]), _.useEffect(() => () => {
		u && (l.layers.delete(u), l.layersWithOutsidePointerEventsDisabled.delete(u), U());
	}, [u, l]), _.useEffect(() => {
		let e = () => p({});
		return document.addEventListener(qi, e), () => document.removeEventListener(qi, e);
	}, []), /* @__PURE__ */ (0, O.jsx)(Vi.div, {
		...c,
		ref: m,
		style: {
			pointerEvents: b ? x ? "auto" : "none" : void 0,
			...e.style
		},
		onFocusCapture: Ti(e.onFocusCapture, C.onFocusCapture),
		onBlurCapture: Ti(e.onBlurCapture, C.onBlurCapture),
		onPointerDownCapture: Ti(e.onPointerDownCapture, S.onPointerDownCapture)
	});
});
Qi.displayName = Ki;
var $i = "DismissableLayerBranch", ea = _.forwardRef((e, t) => {
	let n = _.useContext(Zi), r = _.useRef(null), i = Oi(t, r);
	return _.useEffect(() => {
		let e = r.current;
		if (e) return n.branches.add(e), () => {
			n.branches.delete(e);
		};
	}, [n.branches]), /* @__PURE__ */ (0, O.jsx)(Vi.div, {
		...e,
		ref: i
	});
});
ea.displayName = $i;
function ta(e, t = globalThis?.document) {
	let n = Ui(e), r = _.useRef(!1), i = _.useRef(() => {});
	return _.useEffect(() => {
		let e = (e) => {
			if (e.target && !r.current) {
				let r = function() {
					na(Ji, n, a, { discrete: !0 });
				}, a = { originalEvent: e };
				e.pointerType === "touch" ? (t.removeEventListener("click", i.current), i.current = r, t.addEventListener("click", i.current, { once: !0 })) : r();
			} else t.removeEventListener("click", i.current);
			r.current = !1;
		}, a = window.setTimeout(() => {
			t.addEventListener("pointerdown", e);
		}, 0);
		return () => {
			window.clearTimeout(a), t.removeEventListener("pointerdown", e), t.removeEventListener("click", i.current);
		};
	}, [t, n]), { onPointerDownCapture: () => r.current = !0 };
}
function H(e, t = globalThis?.document) {
	let n = Ui(e), r = _.useRef(!1);
	return _.useEffect(() => {
		let e = (e) => {
			e.target && !r.current && na(Yi, n, { originalEvent: e }, { discrete: !1 });
		};
		return t.addEventListener("focusin", e), () => t.removeEventListener("focusin", e);
	}, [t, n]), {
		onFocusCapture: () => r.current = !0,
		onBlurCapture: () => r.current = !1
	};
}
function U() {
	let e = new CustomEvent(qi);
	document.dispatchEvent(e);
}
function na(e, t, n, { discrete: r }) {
	let i = n.originalEvent.target, a = new CustomEvent(e, {
		bubbles: !1,
		cancelable: !0,
		detail: n
	});
	t && i.addEventListener(e, t, { once: !0 }), r ? Hi(i, a) : i.dispatchEvent(a);
}
// node_modules/@montage-ui/core/dist/components/dismissable-layer/index.mjs
var ra = (0, _.forwardRef)(({ onInteractOutside: e, onFocusOutside: t, onPointerDownOutside: n, ...r }, i) => {
	let a = (0, _.useCallback)((e) => {
		e.target.closest("[data-ignore-dismissable-layer=\"true\"]") && e.preventDefault();
	}, []);
	return /* @__PURE__ */ (0, O.jsx)(Qi, {
		ref: i,
		onPointerDownOutside: Kr((e) => {
			a(e);
		}, n),
		onFocusOutside: Kr((e) => {
			a(e);
		}, t),
		onInteractOutside: Kr((e) => {
			a(e);
		}, e),
		...r
	});
});
ra.displayName = "DismissableLayer";
// node_modules/@radix-ui/react-primitive/dist/index.mjs
var ia = Object.defineProperty, aa = (e, t) => ia(e, "name", {
	value: t,
	configurable: !0
}), oa = [
	"a",
	"button",
	"div",
	"form",
	"h2",
	"h3",
	"img",
	"input",
	"label",
	"li",
	"nav",
	"ol",
	"p",
	"select",
	"span",
	"svg",
	"ul"
].reduce((e, t) => {
	let n = /* @__PURE__ */ se(`Primitive.${t}`), r = _.forwardRef((e, r) => {
		let { asChild: i, ...a } = e, o = i ? n : t;
		return typeof window < "u" && (window[Symbol.for("radix-ui")] = !0), /* @__PURE__ */ (0, O.jsx)(o, {
			...a,
			ref: r
		});
	});
	return r.displayName = `Primitive.${t}`, {
		...e,
		[t]: r
	};
}, {});
function sa(e, t) {
	e && D.flushSync(() => e.dispatchEvent(t));
}
aa(sa, "dispatchDiscreteCustomEvent");
// node_modules/@radix-ui/react-portal/dist/index.mjs
var ca = Object.defineProperty, la = /* @__PURE__ */ _.forwardRef(/* @__PURE__ */ ((e, t) => ca(e, "name", {
	value: t,
	configurable: !0
}))(function(e, t) {
	let { container: n, ...r } = e, [i, a] = _.useState(!1);
	v(() => a(!0), []);
	let o = n || i && globalThis?.document?.body;
	return o ? D.createPortal(/* @__PURE__ */ (0, O.jsx)(oa.div, {
		...r,
		ref: t
	}), o) : null;
}, "Portal")), ua = (0, _.forwardRef)(({ container: e = globalThis?.document?.body, children: t, ...n }, r) => /* @__PURE__ */ (0, O.jsx)(la, {
	container: e,
	ref: r,
	asChild: !0,
	...n,
	children: t
}));
ua.displayName = "Portal";
// node_modules/@montage-ui/core/dist/components/portal-or-fragment/index.mjs
var da = (0, _.forwardRef)(({ disablePortal: e, container: t, children: n, ...r }, i) => /* @__PURE__ */ (0, O.jsx)(Mr, { children: e ? /* @__PURE__ */ (0, O.jsx)(ce, {
	...r,
	ref: i,
	children: n
}) : /* @__PURE__ */ (0, O.jsx)(ua, {
	...r,
	container: t,
	ref: i,
	children: n
}) })), [fa, pa] = Ir("ThemeProvider", {
	theme: void 0,
	resolvedTheme: void 0,
	systemTheme: void 0,
	forcedTheme: void 0,
	setTheme: () => void 0,
	nonce: void 0
}), ma = {
	normal: 2 / 3,
	background: 2 / 3,
	outlined: .47,
	solid: .47
}, ha = .3, ga = {
	xlarge: {
		box: 36,
		iconSize: 24,
		radius: 10
	},
	large: {
		box: 32,
		iconSize: 20,
		radius: 10
	},
	medium: {
		box: 28,
		iconSize: 18,
		radius: 8
	},
	small: {
		box: 24,
		iconSize: 16,
		radius: 8
	}
}, _a = {
	box: 32,
	iconSize: 20
}, va = {
	medium: {
		box: 40,
		iconSize: 18
	},
	small: {
		box: 32,
		iconSize: 16
	}
}, ya = (e) => e === "small" ? "small" : "medium", ba = (e) => Object.keys(e).map(Number).filter((e) => Number.isFinite(e)), xa = (e, t, n = "down") => t.reduce((t, r) => {
	let i = Math.abs(e - t), a = Math.abs(e - r);
	return a < i || a === i && (n === "up" && r > t || n === "down" && r < t) ? r : t;
}, t[0] ?? e), Sa = (e, t) => xa(t, ba(e.dimension), "down"), Ca = (e) => Math.max(...ba(e.dimension)), wa = (e, t) => {
	let n = xa(t, ba(e.radius), "down");
	return e.radius[n];
}, Ta = (e) => Math.max(24, Math.ceil(e * 1.5 / 4) * 4), Ea = ({ xs: e, sm: t, md: n, lg: r, xl: i, ...a }) => (o) => I`
      border-radius: ${o.radius.full};
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      flex-shrink: 0;

      &:disabled,
      &[aria-disabled='true'] {
        pointer-events: none;
        cursor: not-allowed;
      }

      & > [data-component='with-interaction'] {
        width: auto;
        aspect-ratio: 1 / 1;
      }

      ${Na({
	size: a.size,
	variant: a.variant,
	interactionOverflow: a.interactionOverflow
}, o)}
      ${Pa(a, o)}

      ${Yn({
	xs: e,
	sm: t,
	md: n,
	lg: r,
	xl: i
}, o)((e = {}) => I`
          ${Na({
	size: e.size,
	variant: a.variant,
	interactionOverflow: a.interactionOverflow
}, o)}
          ${e.sx}
        `)}
    `, Da = (e) => I`
  & + [data-component='push-badge'] {
    --push-badge-additional-inset: ${e};
  }
`, Oa = (e, t) => `${(e - t) / 2}px`, ka = (e, t, n) => {
	let r = Math.min(Ca(n), Math.max(24, t)), i = Sa(n, r * ma[e ?? "normal"]);
	return I`
    width: ${r}px;
    height: ${r}px;
    ${e === "normal" && I`
        border-radius: ${wa(n, r * .3)};
        ${Da(Oa(r, i))}
      `}

    svg {
      font-size: ${n.dimension[i]};
    }
  `;
}, Aa = (e, t) => I`
  width: ${e.dimension[t.box]};
  height: ${e.dimension[t.box]};
  ${"radius" in t && I`
      border-radius: ${e.radius[t.radius]};
      ${Da(Oa(t.box, t.iconSize))}
    `}

  svg {
    font-size: ${e.dimension[t.iconSize]};
  }
`, ja = (e, t) => {
	let n = typeof e == "number" ? e : ga[e ?? "xlarge"].iconSize, r = Ta(n);
	return {
		iconSize: `${n}px`,
		box: `${r}px`,
		radius: wa(t, r * ha)
	};
}, Ma = (e, t) => {
	let { iconSize: n, box: r, radius: i } = ja(e, t);
	return I`
    width: ${n};
    height: ${n};
    border-radius: ${i};

    & > [data-component='with-interaction'] {
      width: ${r};
      height: ${r};
    }

    svg {
      font-size: ${n};
    }
  `;
}, Na = (e, t) => {
	let { variant: n, size: r, interactionOverflow: i } = e;
	if (i && n === "normal") return Ma(r, t);
	if (typeof r == "number") return ka(n, r, t);
	switch (n) {
		case "normal": return Aa(t, ga[r ?? "xlarge"]);
		case "background": return Aa(t, _a);
		case "outlined":
		case "solid": return Aa(t, va[ya(r)]);
	}
}, Pa = ({ variant: e, color: t, interactionColor: n, interactionEffect: r, alternative: i }, a) => {
	switch (e) {
		case "normal": return I`
        background-color: transparent;
        ${!!t && I`
            color: ${yn(a, t)};
          `}
        border: none;
        box-shadow: none;

        ${r === "dim" && I`
            transition:
              color 0.15s ease,
              opacity 0.15s ease;

            @media (pointer: fine) {
              &:hover {
                color: ${yn(a, n)};
                opacity: ${a.opacity[52]};
              }
            }

            &:active {
              color: ${yn(a, n)};
              opacity: ${a.opacity[22]};
            }

            & > [data-component='with-interaction'] {
              display: none;
            }
          `}

        ${!!n && I`
            & > [data-component='with-interaction'] {
              background-color: ${yn(a, n)};
            }
          `}

        &:disabled,
        &[aria-disabled='true'] {
          background-color: transparent;
          color: ${a.semantic.foreground.disable.primary};
          box-shadow: none;
          border: none;
        }
      `;
		case "background": return I`
        border: none;
        box-shadow: none;
        background-color: transparent;
        color: ${i ? Er(a.semantic.static.white, a.opacity[88]) : Er(a.semantic.static.black, a.opacity[43])};

        ${!i && I`
            @supports (-webkit-backdrop-filter: none) {
              color: ${Er(a.atomic.coolNeutral[50], a.opacity[61])};
            }
          `}

        svg {
          position: relative;

          ${!i && I`
              @supports (-webkit-backdrop-filter: none) {
                will-change: mix-blend-mode;
                mix-blend-mode: plus-darker;
              }
            `}
        }

        ${!!t && I`
            color: ${yn(a, t)};
          `}

        &::before {
          position: absolute;
          content: '';
          inset: 0;
          border-radius: inherit;

          ${i ? I`
                  background-color: ${Er(a.atomic.coolNeutral[30], a.opacity[61])};
                ` : I`
                  background-color: ${Er(a.semantic.static.white, a.opacity[52])};
                  will-change: backdrop-filter;
                  backdrop-filter: blur(32px) saturate(150%) brightness(150%);

                  @supports (-webkit-backdrop-filter: none) {
                    clip-path: inset(0 round 1000px);
                    overflow: auto;
                    border-radius: 0;
                  }

                  @supports (-moz-appearance: none) {
                    clip-path: inset(0 round 1000px);
                    overflow: auto;
                    border-radius: 0;
                  }
                `}
        }

        &:focus-visible {
          outline: none;

          &::before {
            outline-width: 2px;
            outline-style: solid;
            outline-color: Highlight;
            outline-color: -webkit-focus-ring-color;
          }
        }

        &:disabled,
        &[aria-disabled='true'] {
          background-color: transparent;
          color: ${Er(a.atomic.coolNeutral[50], a.opacity[22])};
          border: none;
          box-shadow: none;

          &::before {
            background-color: ${a.semantic.surface.neutral.tertiary};
            backdrop-filter: none;
          }

          svg {
            mix-blend-mode: initial;
          }

          & > [data-role='icon-button-background-blend'] {
            display: none;
          }
          & > [data-role='icon-button-background-blend-layer'] {
            display: none;
          }
        }
      `;
		case "outlined": return I`
        border: none;
        background-color: transparent;
        box-shadow: inset 0 0 0 1px ${a.semantic.line.neutral.secondary};
        background-color: transparent;
        ${!!t && I`
            color: ${yn(a, t)};
          `}

        &:disabled,
        &[aria-disabled='true'] {
          color: ${a.semantic.foreground.disable.primary};
          background-color: transparent;
          box-shadow: inset 0 0 0 1px ${a.semantic.line.neutral.secondary};
        }
      `;
		case "solid": return I`
        border: none;
        background-color: ${a.semantic.surface.brand.primary};

        ${!!t && I`
            color: ${yn(a, t)};
          `}

        &:disabled,
        &[aria-disabled='true'] {
          color: ${a.semantic.foreground.disable.primary};
          background-color: ${a.semantic.surface.neutral.secondary};
          backdrop-filter: blur(32px);
        }
      `;
	}
}, Fa = (e) => I`
  position: absolute;
  content: '';
  background-color: ${Er(e.semantic.static.black, e.opacity[5])};
  inset: 0;
  border-radius: inherit;

  @supports (-webkit-backdrop-filter: none) {
    background-color: ${Er(e.semantic.static.black, .14)};
  }
`, Ia = (0, _.forwardRef)(({ as: e, disabled: t = !1, size: n, variant: r = "normal", interactionEffect: i, interactionColor: a = "semantic.foreground.neutral.primary", alternative: o, interactionOverflow: s, color: c, children: l, xs: u, sm: d, md: f, lg: p, xl: m, ...h }, g) => {
	Un();
	let v = Nr().IconButton?.[r], { base: y, responsive: b } = $n({
		base: n,
		responsive: {
			xs: u,
			sm: d,
			md: f,
			lg: p,
			xl: m
		}
	}, v && {
		base: v.size,
		responsive: v.responsive
	}, "size"), x = s ?? v?.interactionOverflow ?? !1, S = v?.color, C = v?.interactionEffect, ee = (0, _.useMemo)(() => {
		if (c) return c;
		if (S) return S;
		switch (r) {
			case "solid": return "semantic.static.white";
			case "background": return;
			case "normal": return "semantic.foreground.neutral.primary";
			default: return "semantic.foreground.neutral.primary";
		}
	}, [
		S,
		c,
		r
	]), w = (0, _.useMemo)(() => i || C || "highlight", [C, i]);
	return /* @__PURE__ */ (0, O.jsx)(hr, {
		width: "auto",
		height: (() => {
			switch (r) {
				case "normal":
				case "outlined":
				case "solid":
				case "background": return "100%";
			}
		})(),
		color: a,
		disabled: w === "none" || t,
		variant: (() => {
			switch (r) {
				case "normal":
				case "outlined": return "light";
				case "background": return o ? "normal" : "light";
				case "solid": return "strong";
			}
		})(),
		scale: r === "normal",
		children: /* @__PURE__ */ (0, O.jsxs)(V, {
			as: e || "button",
			ref: g,
			"data-component": "icon-button",
			"data-variant": r,
			disabled: t,
			type: "button",
			"aria-disabled": t,
			...h,
			sx: [Ea({
				variant: r,
				size: y,
				alternative: o,
				interactionOverflow: x,
				interactionEffect: w,
				interactionColor: a,
				color: ee,
				...b
			}), h.sx],
			children: [r === "background" && !o && /* @__PURE__ */ (0, O.jsx)(V, {
				as: "span",
				role: "presentation",
				"data-role": "icon-button-background-blend",
				sx: Fa
			}), l]
		})
	});
});
Ia.displayName = "IconButton";
// node_modules/@montage-ui/core/dist/components/focus-scope/helpers.mjs
var La = (e, { select: t = !1 } = {}) => {
	if (e && e.focus) {
		let n = document.activeElement;
		e.focus({ preventScroll: !0 }), e !== n && Ka(e) && t && e.select();
	}
}, Ra = (e, { select: t = !1 } = {}) => {
	let n = document.activeElement;
	for (let r of e) if (La(r, { select: t }), document.activeElement !== n) return;
}, za = (e) => {
	let t = Ba(e);
	return [Wa(t, e), Wa(t.reverse(), e)];
}, Ba = (e) => {
	let t = [], n = document.createTreeWalker(e, NodeFilter.SHOW_ELEMENT, { acceptNode: (e) => {
		let t = e.tagName === "INPUT" && e.type === "hidden";
		return e.disabled || e.hidden || t ? NodeFilter.FILTER_SKIP : e.tabIndex >= 0 ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
	} });
	for (; n.nextNode();) t.push(n.currentNode);
	return t;
}, Va = (e) => e.sort((e, t) => {
	let n = e.getAttribute("data-ignore-first-focus") === "true", r = t.getAttribute("data-ignore-first-focus") === "true";
	return n && !r ? 1 : !n && r ? -1 : 0;
}), Ha = (e, t) => {
	let n = [...e], r = n.indexOf(t);
	return r !== -1 && n.splice(r, 1), n;
}, Ua = (e) => e.filter((e) => e.tagName !== "A"), Wa = (e, t) => {
	let n = typeof t.checkVisibility == "function" && t.checkVisibility({ checkVisibilityCSS: !0 });
	for (let r of e) if (!(n ? !r.checkVisibility({ checkVisibilityCSS: !0 }) : Ga(r, { upTo: t }))) return r;
}, Ga = (e, { upTo: t }) => {
	if (getComputedStyle(e).visibility === "hidden") return !0;
	for (; e;) {
		if (t !== void 0 && e === t) return !1;
		if (getComputedStyle(e).display === "none") return !0;
		e = e.parentElement;
	}
	return !1;
}, Ka = (e) => e instanceof HTMLInputElement && "select" in e, qa = "focusScope.autoFocusOnMount", Ja = "focusScope.autoFocusOnUnmount", Ya = {
	bubbles: !1,
	cancelable: !0
}, Xa = (0, _.forwardRef)(({ loop: e = !1, trapped: t = !0, trappedContent: n = !1, disableFocusScope: r = !1, children: i, onMountAutoFocus: a, onUnmountAutoFocus: o, ...s }, c) => r ? /* @__PURE__ */ (0, O.jsx)(ce, {
	ref: c,
	...s,
	children: i
}) : /* @__PURE__ */ (0, O.jsx)(Za, {
	...s,
	ref: c,
	loop: e,
	trapped: t,
	trappedContent: n,
	onMountAutoFocus: a,
	onUnmountAutoFocus: o,
	children: i
}));
Xa.displayName = "FocusScope";
var Za = (0, _.forwardRef)(({ loop: e = !1, trapped: t = !0, trappedContent: n = !1, onMountAutoFocus: r, onUnmountAutoFocus: i, ...a }, o) => {
	let [s, c] = (0, _.useState)(null), l = S(r), u = S(i), d = (0, _.useRef)(null), [f] = (0, _.useState)(() => typeof document > "u" ? null : document.activeElement), p = ie(o, (e) => c(e)), m = (0, _.useRef)({
		paused: !1,
		pause() {
			this.paused = !0;
		},
		resume() {
			this.paused = !1;
		}
	}).current;
	(0, _.useEffect)(() => {
		if (t) {
			let e = (e) => {
				if (m.paused || !s) return;
				let t = e.target;
				s.contains(t) ? d.current = t : La(d.current, { select: !0 });
			}, t = (e) => {
				if (m.paused || !s) return;
				let t = e.relatedTarget;
				t !== null && (s.contains(t) || La(d.current, { select: !0 }));
			}, n = (e) => {
				if (document.activeElement === document.body) for (let t of e) t.removedNodes.length > 0 && La(s);
			};
			document.addEventListener("focusin", e), document.addEventListener("focusout", t);
			let r = new MutationObserver(n);
			return s && r.observe(s, {
				childList: !0,
				subtree: !0
			}), () => {
				document.removeEventListener("focusin", e), document.removeEventListener("focusout", t), r.disconnect();
			};
		}
	}, [
		t,
		s,
		m.paused
	]), (0, _.useEffect)(() => {
		if (s) {
			Qa.add(m), $a.add(s);
			let e = f;
			if (!s.contains(document.activeElement)) {
				let e = new CustomEvent(qa, Ya);
				if (s.addEventListener(qa, l), s.dispatchEvent(e), !e.defaultPrevented) {
					let e = Va(Ua(Ba(s)));
					e.length === 0 ? La(s) : n ? Ra(e, { select: !0 }) : La(s);
				}
			}
			return () => {
				s.removeEventListener(qa, l), $a.delete(s), setTimeout(() => {
					let t = new CustomEvent(Ja, Ya);
					s.addEventListener(Ja, u), s.dispatchEvent(t);
					let n = document.activeElement, r = !n || n === document.body || $a.has(n);
					!t.defaultPrevented && r && La(e ?? document.body, { select: !0 }), s.removeEventListener(Ja, u), Qa.remove(m);
				}, 0);
			};
		}
	}, [
		s,
		l,
		u,
		m,
		n,
		f
	]);
	let h = (0, _.useCallback)((n) => {
		if (!e && !t || m.paused) return;
		let r = n.key === "Tab" && !n.altKey && !n.ctrlKey && !n.metaKey, i = document.activeElement;
		if (r && i) {
			let t = n.currentTarget, [r, a] = za(t);
			r && a ? !n.shiftKey && i === a ? (n.preventDefault(), e && La(r, { select: !0 })) : n.shiftKey && i === r && (n.preventDefault(), e && La(a, { select: !0 })) : i === t && n.preventDefault();
		}
	}, [
		e,
		t,
		m.paused
	]);
	return /* @__PURE__ */ (0, O.jsxs)(O.Fragment, { children: [/* @__PURE__ */ (0, O.jsx)(ce, {
		tabIndex: -1,
		ref: p,
		...a,
		onKeyDown: Kr(a.onKeyDown, h)
	}), /* @__PURE__ */ (0, O.jsx)("span", {
		"data-component": "focus-guard",
		tabIndex: t ? 0 : -1,
		style: {
			outline: "none",
			opacity: "0",
			position: "fixed",
			pointerEvents: "none"
		}
	})] });
}), Qa = (() => {
	let e = [];
	return {
		add(t) {
			let n = e[0];
			t !== n && n?.pause(), e = Ha(e, t), e.unshift(t);
		},
		remove(t) {
			e = Ha(e, t), e[0]?.resume();
		}
	};
})(), $a = /* @__PURE__ */ new Set(), eo = function() {
	return eo = Object.assign || function(e) {
		for (var t, n = 1, r = arguments.length; n < r; n++) for (var i in t = arguments[n], t) Object.prototype.hasOwnProperty.call(t, i) && (e[i] = t[i]);
		return e;
	}, eo.apply(this, arguments);
};
function to(e, t) {
	var n = {};
	for (var r in e) Object.prototype.hasOwnProperty.call(e, r) && t.indexOf(r) < 0 && (n[r] = e[r]);
	if (e != null && typeof Object.getOwnPropertySymbols == "function") for (var i = 0, r = Object.getOwnPropertySymbols(e); i < r.length; i++) t.indexOf(r[i]) < 0 && Object.prototype.propertyIsEnumerable.call(e, r[i]) && (n[r[i]] = e[r[i]]);
	return n;
}
function no(e, t, n) {
	if (n || arguments.length === 2) for (var r = 0, i = t.length, a; r < i; r++) (a || !(r in t)) && (a ||= Array.prototype.slice.call(t, 0, r), a[r] = t[r]);
	return e.concat(a || Array.prototype.slice.call(t));
}
// node_modules/react-remove-scroll-bar/dist/es2015/constants.js
var ro = "right-scroll-bar-position", io = "width-before-scroll-bar", ao = "with-scroll-bars-hidden", oo = "--removed-body-scroll-bar-size";
// node_modules/use-callback-ref/dist/es2015/assignRef.js
function so(e, t) {
	return typeof e == "function" ? e(t) : e && (e.current = t), e;
}
// node_modules/use-callback-ref/dist/es2015/useRef.js
function co(e, t) {
	var n = (0, _.useState)(function() {
		return {
			value: e,
			callback: t,
			facade: {
				get current() {
					return n.value;
				},
				set current(e) {
					var t = n.value;
					t !== e && (n.value = e, n.callback(e, t));
				}
			}
		};
	})[0];
	return n.callback = t, n.facade;
}
// node_modules/use-callback-ref/dist/es2015/useMergeRef.js
var lo = typeof window < "u" ? _.useLayoutEffect : _.useEffect, uo = /* @__PURE__ */ new WeakMap();
function fo(e, t) {
	var n = co(t || null, function(t) {
		return e.forEach(function(e) {
			return so(e, t);
		});
	});
	return lo(function() {
		var t = uo.get(n);
		if (t) {
			var r = new Set(t), i = new Set(e), a = n.current;
			r.forEach(function(e) {
				i.has(e) || so(e, null);
			}), i.forEach(function(e) {
				r.has(e) || so(e, a);
			});
		}
		uo.set(n, e);
	}, [e]), n;
}
// node_modules/use-sidecar/dist/es2015/medium.js
function po(e) {
	return e;
}
function mo(e, t) {
	t === void 0 && (t = po);
	var n = [], r = !1;
	return {
		read: function() {
			if (r) throw Error("Sidecar: could not `read` from an `assigned` medium. `read` could be used only with `useMedium`.");
			return n.length ? n[n.length - 1] : e;
		},
		useMedium: function(e) {
			var i = t(e, r);
			return n.push(i), function() {
				n = n.filter(function(e) {
					return e !== i;
				});
			};
		},
		assignSyncMedium: function(e) {
			for (r = !0; n.length;) {
				var t = n;
				n = [], t.forEach(e);
			}
			n = {
				push: function(t) {
					return e(t);
				},
				filter: function() {
					return n;
				}
			};
		},
		assignMedium: function(e) {
			r = !0;
			var t = [];
			if (n.length) {
				var i = n;
				n = [], i.forEach(e), t = n;
			}
			var a = function() {
				var n = t;
				t = [], n.forEach(e);
			}, o = function() {
				return Promise.resolve().then(a);
			};
			o(), n = {
				push: function(e) {
					t.push(e), o();
				},
				filter: function(e) {
					return t = t.filter(e), n;
				}
			};
		}
	};
}
function ho(e) {
	e === void 0 && (e = {});
	var t = mo(null);
	return t.options = eo({
		async: !0,
		ssr: !1
	}, e), t;
}
// node_modules/use-sidecar/dist/es2015/exports.js
var go = function(e) {
	var t = e.sideCar, n = to(e, ["sideCar"]);
	if (!t) throw Error("Sidecar: please provide `sideCar` property to import the right car");
	var r = t.read();
	if (!r) throw Error("Sidecar medium not found");
	return _.createElement(r, eo({}, n));
};
go.isSideCarExport = !0;
function _o(e, t) {
	return e.useMedium(t), go;
}
// node_modules/react-remove-scroll/dist/es2015/medium.js
var vo = ho(), yo = function() {}, bo = _.forwardRef(function(e, t) {
	var n = _.useRef(null), r = _.useState({
		onScrollCapture: yo,
		onWheelCapture: yo,
		onTouchMoveCapture: yo
	}), i = r[0], a = r[1], o = e.forwardProps, s = e.children, c = e.className, l = e.removeScrollBar, u = e.enabled, d = e.shards, f = e.sideCar, p = e.noRelative, m = e.noIsolation, h = e.inert, g = e.allowPinchZoom, v = e.as, y = v === void 0 ? "div" : v, b = e.gapMode, x = to(e, [
		"forwardProps",
		"children",
		"className",
		"removeScrollBar",
		"enabled",
		"shards",
		"sideCar",
		"noRelative",
		"noIsolation",
		"inert",
		"allowPinchZoom",
		"as",
		"gapMode"
	]), S = f, C = fo([n, t]), ee = eo(eo({}, x), i);
	return _.createElement(_.Fragment, null, u && _.createElement(S, {
		sideCar: vo,
		removeScrollBar: l,
		shards: d,
		noRelative: p,
		noIsolation: m,
		inert: h,
		setCallbacks: a,
		allowPinchZoom: !!g,
		lockRef: n,
		gapMode: b
	}), o ? _.cloneElement(_.Children.only(s), eo(eo({}, ee), { ref: C })) : _.createElement(y, eo({}, ee, {
		className: c,
		ref: C
	}), s));
});
bo.defaultProps = {
	enabled: !0,
	removeScrollBar: !0,
	inert: !1
}, bo.classNames = {
	fullWidth: io,
	zeroRight: ro
};
// node_modules/get-nonce/dist/es2015/index.js
var xo = function() {
	if (typeof __webpack_nonce__ < "u") return __webpack_nonce__;
};
// node_modules/react-style-singleton/dist/es2015/singleton.js
function So() {
	if (!document) return null;
	var e = document.createElement("style");
	e.type = "text/css";
	var t = xo();
	return t && e.setAttribute("nonce", t), e;
}
function Co(e, t) {
	e.styleSheet ? e.styleSheet.cssText = t : e.appendChild(document.createTextNode(t));
}
function wo(e) {
	(document.head || document.getElementsByTagName("head")[0]).appendChild(e);
}
var To = function() {
	var e = 0, t = null;
	return {
		add: function(n) {
			e == 0 && (t = So()) && (Co(t, n), wo(t)), e++;
		},
		remove: function() {
			e--, !e && t && (t.parentNode && t.parentNode.removeChild(t), t = null);
		}
	};
}, Eo = function() {
	var e = To();
	return function(t, n) {
		_.useEffect(function() {
			return e.add(t), function() {
				e.remove();
			};
		}, [t && n]);
	};
}, Do = function() {
	var e = Eo();
	return function(t) {
		var n = t.styles, r = t.dynamic;
		return e(n, r), null;
	};
}, Oo = {
	left: 0,
	top: 0,
	right: 0,
	gap: 0
}, ko = function(e) {
	return parseInt(e || "", 10) || 0;
}, Ao = function(e) {
	var t = window.getComputedStyle(document.body), n = t[e === "padding" ? "paddingLeft" : "marginLeft"], r = t[e === "padding" ? "paddingTop" : "marginTop"], i = t[e === "padding" ? "paddingRight" : "marginRight"];
	return [
		ko(n),
		ko(r),
		ko(i)
	];
}, jo = function(e) {
	if (e === void 0 && (e = "margin"), typeof window > "u") return Oo;
	var t = Ao(e), n = document.documentElement.clientWidth, r = window.innerWidth;
	return {
		left: t[0],
		top: t[1],
		right: t[2],
		gap: Math.max(0, r - n + t[2] - t[0])
	};
}, Mo = Do(), No = "data-scroll-locked", Po = function(e, t, n, r) {
	var i = e.left, a = e.top, o = e.right, s = e.gap;
	return n === void 0 && (n = "margin"), `
  .${ao} {
   overflow: hidden ${r};
   padding-right: ${s}px ${r};
  }
  body[${No}] {
    overflow: hidden ${r};
    overscroll-behavior: contain;
    ${[
		t && `position: relative ${r};`,
		n === "margin" && `
    padding-left: ${i}px;
    padding-top: ${a}px;
    padding-right: ${o}px;
    margin-left:0;
    margin-top:0;
    margin-right: ${s}px ${r};
    `,
		n === "padding" && `padding-right: ${s}px ${r};`
	].filter(Boolean).join("")}
  }
  
  .${ro} {
    right: ${s}px ${r};
  }
  
  .${io} {
    margin-right: ${s}px ${r};
  }
  
  .${ro} .${ro} {
    right: 0 ${r};
  }
  
  .${io} .${io} {
    margin-right: 0 ${r};
  }
  
  body[${No}] {
    ${oo}: ${s}px;
  }
`;
}, Fo = function() {
	var e = parseInt(document.body.getAttribute("data-scroll-locked") || "0", 10);
	return isFinite(e) ? e : 0;
}, Io = function() {
	_.useEffect(function() {
		return document.body.setAttribute(No, (Fo() + 1).toString()), function() {
			var e = Fo() - 1;
			e <= 0 ? document.body.removeAttribute(No) : document.body.setAttribute(No, e.toString());
		};
	}, []);
}, Lo = function(e) {
	var t = e.noRelative, n = e.noImportant, r = e.gapMode, i = r === void 0 ? "margin" : r;
	Io();
	var a = _.useMemo(function() {
		return jo(i);
	}, [i]);
	return _.createElement(Mo, { styles: Po(a, !t, i, n ? "" : "!important") });
}, Ro = !1;
if (typeof window < "u") try {
	var zo = Object.defineProperty({}, "passive", { get: function() {
		return Ro = !0, !0;
	} });
	window.addEventListener("test", zo, zo), window.removeEventListener("test", zo, zo);
} catch {
	Ro = !1;
}
var W = Ro ? { passive: !1 } : !1, G = function(e) {
	return e.tagName === "TEXTAREA";
}, Bo = function(e, t) {
	if (!(e instanceof Element)) return !1;
	var n = window.getComputedStyle(e);
	return n[t] !== "hidden" && !(n.overflowY === n.overflowX && !G(e) && n[t] === "visible");
}, Vo = function(e) {
	return Bo(e, "overflowY");
}, Ho = function(e) {
	return Bo(e, "overflowX");
}, Uo = function(e, t) {
	var n = t.ownerDocument, r = t;
	do {
		if (typeof ShadowRoot < "u" && r instanceof ShadowRoot && (r = r.host), Ko(e, r)) {
			var i = qo(e, r);
			if (i[1] > i[2]) return !0;
		}
		r = r.parentNode;
	} while (r && r !== n.body);
	return !1;
}, Wo = function(e) {
	return [
		e.scrollTop,
		e.scrollHeight,
		e.clientHeight
	];
}, Go = function(e) {
	return [
		e.scrollLeft,
		e.scrollWidth,
		e.clientWidth
	];
}, Ko = function(e, t) {
	return e === "v" ? Vo(t) : Ho(t);
}, qo = function(e, t) {
	return e === "v" ? Wo(t) : Go(t);
}, Jo = function(e, t) {
	return e === "h" && t === "rtl" ? -1 : 1;
}, Yo = function(e, t, n, r, i) {
	var a = Jo(e, window.getComputedStyle(t).direction), o = a * r, s = n.target, c = t.contains(s), l = !1, u = o > 0, d = 0, f = 0;
	do {
		if (!s) break;
		var p = qo(e, s), m = p[0], h = p[1] - p[2] - a * m;
		(m || h) && Ko(e, s) && (d += h, f += m);
		var g = s.parentNode;
		s = g && g.nodeType === Node.DOCUMENT_FRAGMENT_NODE ? g.host : g;
	} while (!c && s !== document.body || c && (t.contains(s) || t === s));
	return (u && (i && Math.abs(d) < 1 || !i && o > d) || !u && (i && Math.abs(f) < 1 || !i && -o > f)) && (l = !0), l;
}, Xo = function(e) {
	return "changedTouches" in e ? [e.changedTouches[0].clientX, e.changedTouches[0].clientY] : [0, 0];
}, Zo = function(e) {
	return [e.deltaX, e.deltaY];
}, Qo = function(e) {
	return e && "current" in e ? e.current : e;
}, $o = function(e, t) {
	return e[0] === t[0] && e[1] === t[1];
}, es = function(e) {
	return `
  .block-interactivity-${e} {pointer-events: none;}
  .allow-interactivity-${e} {pointer-events: all;}
`;
}, ts = 0, ns = [];
function rs(e) {
	var t = _.useRef([]), n = _.useRef([0, 0]), r = _.useRef(), i = _.useState(ts++)[0], a = _.useState(Do)[0], o = _.useRef(e);
	_.useEffect(function() {
		o.current = e;
	}, [e]), _.useEffect(function() {
		if (e.inert) {
			document.body.classList.add(`block-interactivity-${i}`);
			var t = no([e.lockRef.current], (e.shards || []).map(Qo), !0).filter(Boolean);
			return t.forEach(function(e) {
				return e.classList.add(`allow-interactivity-${i}`);
			}), function() {
				document.body.classList.remove(`block-interactivity-${i}`), t.forEach(function(e) {
					return e.classList.remove(`allow-interactivity-${i}`);
				});
			};
		}
	}, [
		e.inert,
		e.lockRef.current,
		e.shards
	]);
	var s = _.useCallback(function(e, t) {
		if ("touches" in e && e.touches.length === 2 || e.type === "wheel" && e.ctrlKey) return !o.current.allowPinchZoom;
		var i = Xo(e), a = n.current, s = "deltaX" in e ? e.deltaX : a[0] - i[0], c = "deltaY" in e ? e.deltaY : a[1] - i[1], l, u = e.target, d = Math.abs(s) > Math.abs(c) ? "h" : "v";
		if ("touches" in e && d === "h" && u.type === "range") return !1;
		var f = window.getSelection(), p = f && f.anchorNode;
		if (p && (p === u || p.contains(u))) return !1;
		var m = Uo(d, u);
		if (!m) return !0;
		if (m ? l = d : (l = d === "v" ? "h" : "v", m = Uo(d, u)), !m) return !1;
		if (!r.current && "changedTouches" in e && (s || c) && (r.current = l), !l) return !0;
		var h = r.current || l;
		return Yo(h, t, e, h === "h" ? s : c, !0);
	}, []), c = _.useCallback(function(e) {
		var n = e;
		if (ns.length && ns[ns.length - 1] === a) {
			var r = "deltaY" in n ? Zo(n) : Xo(n), i = t.current.filter(function(e) {
				return e.name === n.type && (e.target === n.target || n.target === e.shadowParent) && $o(e.delta, r);
			})[0];
			if (i && i.should) n.cancelable && n.preventDefault();
			else if (!i) {
				var c = (o.current.shards || []).map(Qo).filter(Boolean).filter(function(e) {
					return e.contains(n.target);
				});
				(c.length > 0 ? s(n, c[0]) : !o.current.noIsolation) && n.cancelable && n.preventDefault();
			}
		}
	}, []), l = _.useCallback(function(e, n, r, i) {
		var a = {
			name: e,
			delta: n,
			target: r,
			should: i,
			shadowParent: is(r)
		};
		t.current.push(a), setTimeout(function() {
			t.current = t.current.filter(function(e) {
				return e !== a;
			});
		}, 1);
	}, []), u = _.useCallback(function(e) {
		n.current = Xo(e), r.current = void 0;
	}, []), d = _.useCallback(function(t) {
		l(t.type, Zo(t), t.target, s(t, e.lockRef.current));
	}, []), f = _.useCallback(function(t) {
		l(t.type, Xo(t), t.target, s(t, e.lockRef.current));
	}, []);
	_.useEffect(function() {
		return ns.push(a), e.setCallbacks({
			onScrollCapture: d,
			onWheelCapture: d,
			onTouchMoveCapture: f
		}), document.addEventListener("wheel", c, W), document.addEventListener("touchmove", c, W), document.addEventListener("touchstart", u, W), function() {
			ns = ns.filter(function(e) {
				return e !== a;
			}), document.removeEventListener("wheel", c, W), document.removeEventListener("touchmove", c, W), document.removeEventListener("touchstart", u, W);
		};
	}, []);
	var p = e.removeScrollBar, m = e.inert;
	return _.createElement(_.Fragment, null, m ? _.createElement(a, { styles: es(i) }) : null, p ? _.createElement(Lo, {
		noRelative: e.noRelative,
		gapMode: e.gapMode
	}) : null);
}
function is(e) {
	for (var t = null; e !== null;) e instanceof ShadowRoot && (t = e.host, e = e.host), e = e.parentNode;
	return t;
}
// node_modules/react-remove-scroll/dist/es2015/sidecar.js
var as = _o(vo, rs), os = _.forwardRef(function(e, t) {
	return _.createElement(bo, eo({}, e, {
		ref: t,
		sideCar: as
	}));
});
os.classNames = bo.classNames;
// node_modules/@montage-ui/core/dist/components/alert/constants.mjs
var ss = "Alert", cs = "AlertDimmer", ls = "AlertTrigger", us = "AlertContainer", ds = "AlertContent", fs = "AlertHeading", ps = "AlertDescription", ms = "AlertActionArea", hs = "AlertActionAreaButton", [gs, _s] = Ir(ss), [vs, ys] = Ir(us), bs = (e) => I`
  position: fixed;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: ${e.zIndex.modal};
  width: 100vw;
  height: 100dvh;
  left: 0px;
  top: 0px;
`, xs = (e) => I`
  position: fixed;
  inset: 0;
  background-color: ${Er(e.semantic.effect.dimmer.primary, e.opacity[43])};
  z-index: -1;
  /* See \`modalDimmerStyle\` — opt back in under \`disableOutsidePointerEvents\`. */
  pointer-events: auto;

  &[data-status='close'] {
    pointer-events: none;
  }
`, Ss = (e) => I`
  background-color: ${e.semantic.surface.elevated.primary};
  border-radius: 12px;
  min-width: 320px;
  max-width: 400px;
  outline: none;
  display: flex;
  flex-direction: column;

  ${Ee("360px")} {
    min-width: 100%;
  }
`, Cs = I`
  padding: 20px;
`, ws = I`
  padding: 0px 20px 12px 20px;
`, Ts = ({ open: e, defaultOpen: t, onOpenChange: n, children: r }) => {
	let [i, a] = ai({
		prop: e,
		defaultProp: t ?? !1,
		onChange: n
	});
	return /* @__PURE__ */ (0, O.jsx)(gs, {
		open: i,
		setOpen: a,
		headingId: (0, _.useId)(),
		descriptionId: (0, _.useId)(),
		containerId: (0, _.useId)(),
		children: r
	});
};
Ts.displayName = ss;
var Es = (0, _.forwardRef)(({ as: e, ...t }, n) => {
	let { dimmerRef: r } = ys(cs), { open: i } = _s(cs);
	return /* @__PURE__ */ (0, O.jsx)(V, {
		ref: re(n, r),
		as: e || "div",
		...t,
		"data-role": "alert-dimmer",
		"data-status": i ? "open" : "close",
		sx: [xs, t.sx]
	});
});
Es.displayName = cs;
var Ds = (0, _.forwardRef)((e, t) => {
	let { containerId: n, open: r, setOpen: i } = _s(ls);
	return /* @__PURE__ */ (0, O.jsx)(ce, {
		ref: t,
		"aria-controls": n,
		"aria-haspopup": "dialog",
		"aria-expanded": r,
		...e,
		onClick: Kr(e.onClick, () => {
			i(!0);
		})
	});
});
Ds.displayName = ls;
var Os = (0, _.forwardRef)(({ disableOutsideClickClose: e = !1, disableEscapeKeyDownClose: t, disableRemoveScroll: n = !1, disableFocusScope: r = !1, disableAriaHiddenOthers: i = !1, disablePortal: a, container: o, onDismiss: s, forceMount: c = !1, wrapperProps: l, dimmer: u = /* @__PURE__ */ (0, O.jsx)(Es, {}), children: d, ...f }, p) => {
	let { open: m, setOpen: h, headingId: g, descriptionId: v, containerId: y } = _s(us), b = (0, _.useRef)(null), x = (0, _.useRef)(null), S = ie(x, p), { isPresent: C, ref: ee } = w(m || c, {
		subtree: !0,
		filter: (e) => e.isSameNode(x.current) || e.isSameNode(b.current)
	});
	return (0, _.useEffect)(() => {
		let e = x.current;
		if (e && C && !i) return Tr(e);
	}, [C, i]), C ? /* @__PURE__ */ (0, O.jsx)(vs, {
		dimmerRef: b,
		disableOutsideClickClose: e,
		onDismiss: s,
		children: /* @__PURE__ */ (0, O.jsx)(da, {
			container: a ? null : o,
			disablePortal: a,
			ref: ee,
			children: /* @__PURE__ */ (0, O.jsxs)(nr, {
				...l,
				sx: [bs, l?.sx],
				children: [u, /* @__PURE__ */ (0, O.jsx)(Xa, {
					loop: !0,
					trapped: !0,
					disableFocusScope: r,
					children: /* @__PURE__ */ (0, O.jsx)(ra, {
						disableOutsidePointerEvents: !i,
						onPointerDownOutside: (t) => {
							let n = t.detail.originalEvent, r = n.button === 0 && n.ctrlKey === !0;
							(n.button === 2 || r || e) && t.preventDefault();
						},
						onFocusOutside: (e) => e.preventDefault(),
						onEscapeKeyDown: (e) => {
							t && e.preventDefault();
						},
						onDismiss: () => {
							s?.(), h(!1);
						},
						role: "presentation",
						asChild: !0,
						children: /* @__PURE__ */ (0, O.jsx)(os, {
							as: ce,
							allowPinchZoom: !0,
							enabled: !n,
							children: /* @__PURE__ */ (0, O.jsx)(V, {
								ref: S,
								role: "alertdialog",
								"aria-modal": !i,
								"aria-describedby": v,
								"aria-labelledby": g,
								id: y,
								"data-status": m ? "open" : "close",
								...f,
								sx: [Ss, f.sx],
								children: d
							})
						})
					})
				})]
			})
		})
	}) : null;
});
Os.displayName = us;
var ks = (0, _.forwardRef)(({ children: e, ...t }, n) => /* @__PURE__ */ (0, O.jsx)(nr, {
	ref: n,
	flexDirection: "column",
	gap: "6px",
	...t,
	sx: [Cs, t.sx],
	children: e
}));
ks.displayName = ds;
var As = (0, _.forwardRef)(({ children: e, ...t }, n) => {
	let { headingId: r } = _s(fs);
	return /* @__PURE__ */ (0, O.jsx)(ur, {
		"data-component": "alert-title",
		variant: "headline1",
		weight: "bold",
		color: "semantic.foreground.neutral.primary",
		ref: n,
		as: "h2",
		id: r,
		...t,
		sx: [{
			wordBreak: "keep-all",
			overflowWrap: "anywhere"
		}, t.sx],
		children: e
	});
});
As.displayName = fs;
var js = (0, _.forwardRef)(({ children: e, ...t }, n) => {
	let { descriptionId: r } = _s(ps);
	return /* @__PURE__ */ (0, O.jsx)(ur, {
		variant: "body2",
		weight: "regular",
		color: "semantic.foreground.neutral.tertiary",
		"data-component": "alert-description",
		ref: n,
		as: "p",
		id: r,
		...t,
		sx: [{
			wordBreak: "keep-all",
			overflowWrap: "anywhere"
		}, t.sx],
		children: e
	});
});
js.displayName = ps;
var Ms = (0, _.forwardRef)(({ children: e, ...t }, n) => /* @__PURE__ */ (0, O.jsx)(nr, {
	flexDirection: "row",
	alignItems: "center",
	"data-component": "alert-action-area",
	justifyContent: "flex-end",
	gap: "24px",
	ref: n,
	...t,
	sx: [ws, t.sx],
	children: e
}));
Ms.displayName = ms;
var Ns = (0, _.forwardRef)(({ variant: e = "normal", ...t }, n) => {
	let { setOpen: r } = _s(hs);
	return /* @__PURE__ */ (0, O.jsx)(wi, {
		size: "medium",
		color: e === "normal" ? "primary" : "assistive",
		ref: n,
		...t,
		onClick: Kr(t.onClick, () => {
			r(!1);
		}),
		sx: e === "negative" ? [(e) => ({
			color: yn(e, "semantic.foreground.negative.primary"),
			"[data-component=\"with-interaction\"]": { backgroundColor: yn(e, "semantic.foreground.negative.primary") }
		}), t.sx] : t.sx
	});
});
Ns.displayName = hs;
// node_modules/@montage-ui/core/dist/stores/helpers.mjs
var Ps = () => {
	let e = (/* @__PURE__ */ new Date()).getTime();
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (t) => {
		let n = Math.random() * 16;
		return n = (e + n) % 16 | 0, e = Math.floor(e / 16), (t === "x" ? n : (n && 3) | 8).toString(16);
	});
}, Fs = (e) => {
	let t, n = /* @__PURE__ */ new Set(), r = (e, r) => {
		let i = typeof e == "function" ? e(t) : e;
		if (!Object.is(i, t)) {
			let e = t;
			t = r ?? (typeof i != "object" || !i) ? i : Object.assign({}, t, i), n.forEach((n) => n(t, e));
		}
	}, i = () => t, a = {
		setState: r,
		getState: i,
		getInitialState: () => o,
		subscribe: (e) => (n.add(e), () => n.delete(e))
	}, o = t = e(r, i, a);
	return a;
}, Is = ((e) => e ? Fs(e) : Fs), Ls = (e) => e;
function Rs(e, t = Ls) {
	let n = _.useSyncExternalStore(e.subscribe, _.useCallback(() => t(e.getState()), [e, t]), () => t(e.getInitialState()));
	return _.useDebugValue(n), n;
}
// node_modules/@montage-ui/core/dist/stores/alert-store.mjs
var zs = { items: [] }, Bs = (e = zs) => Is()((t) => ({
	...e,
	show: (e) => t((t) => ({ items: [...t.items, {
		id: Ps(),
		...e
	}] })),
	hide: (e) => t((t) => ({ items: t.items.filter(({ id: t }) => t !== e) }))
})), Vs = (0, _.createContext)(null), Hs = (e) => {
	let t = (0, _.useContext)(Vs);
	if (!t) throw Error("useAlertStore must be use within AlertProvider");
	return Rs(t, e);
}, Us = {
	items: [],
	config: {
		viewportMaxWidth: "1060px",
		viewportBottom: "0px"
	}
}, Ws = (e = Us) => Is()((t) => ({
	...e,
	add: (e) => t((t) => {
		let n = e.id ?? Ps();
		return t.items.find((e) => e.id === n) ? t : { items: [...t.items, {
			...e,
			visibility: "visible",
			id: n
		}] };
	}),
	removeAll: () => t(() => ({ items: [] })),
	remove: (e) => t((t) => ({ items: t.items.filter(({ id: t }) => t !== e) })),
	hide: (e) => t((t) => ({ items: t.items.map((t) => t.id === e ? {
		...t,
		visibility: "hidden"
	} : t) })),
	hideAll: () => t((e) => ({ items: e.items.map((e) => ({
		...e,
		visibility: "hidden"
	})) })),
	setConfig: (e) => t((t) => ({ config: {
		...t.config,
		...e
	} }))
})), Gs = (0, _.createContext)(null), Ks = (e) => {
	let t = (0, _.useContext)(Gs);
	if (!t) throw Error("useRegionStore must be use within RegionProvider");
	return Rs(t, e);
}, qs = ["light", "dark"], Js = () => {
	let { resolvedTheme: e, forcedTheme: t, theme: n, setTheme: r } = pa("useThemeControl");
	return {
		theme: (0, _.useMemo)(() => e ? qs.includes(t) ? t : qs.includes(e) ? e : "light" : "light", [e, t]),
		themeOriginValue: n,
		setTheme: r
	};
}, Ys = () => window.matchMedia("(pointer: fine)").matches, Xs = ({ open: e, duration: t, onAnimationEnd: n, setOpen: r, disablePortal: i, component: a = "toast" }) => {
	let o = (0, _.useRef)(void 0), s = (0, _.useRef)(void 0), c = (0, _.useRef)(void 0), [l, u] = (0, _.useState)(0), d = (0, _.useCallback)((e) => {
		if (e) {
			let t = () => {
				let t = e.getBoundingClientRect().height;
				u(t);
			};
			t(), new MutationObserver(t).observe(e, {
				subtree: !0,
				childList: !0,
				characterData: !0
			});
		}
	}, [u]), f = (0, _.useCallback)((e) => {
		e !== Infinity && (s.current = Date.now(), c.current = e, o.current = setTimeout(() => {
			r(!1);
		}, e));
	}, [r]), p = (0, _.useCallback)(() => {
		o.current &&= (clearTimeout(o.current), void 0);
	}, []);
	return (0, _.useEffect)(() => (e && f(typeof t == "number" ? t : 3e3), p), [
		e,
		t,
		f,
		p
	]), {
		ref: d,
		handleAnimationEnd: () => {
			e ? n?.("show") : n?.("hide");
		},
		handleMouseEnter: () => {
			if (Ys() && o.current && s.current && c.current) {
				p();
				let e = Date.now() - s.current;
				c.current = Math.max(0, c.current - e);
			}
		},
		handleMouseLeave: () => {
			e && c.current !== void 0 && f(c.current);
		},
		style: {
			[`--${a}-animation-height`]: `${l}px`,
			[`--${a}-animation-margin-top`]: i ? 0 : "10px"
		}
	};
}, Zs = "Snackbar", Qs = "SnackbarContent", $s = "SnackbarExtraContent", ec = "SnackbarHeading", tc = "SnackbarDescription", nc = "SnackbarAction", rc = "SnackbarCloseButton", [ic, ac] = Ir(Zs), oc = _n`
  from {
    opacity: 0;
    height: 0;
    margin-top: 0;
  }
  to {
    opacity: 1;
    height: var(--snackbar-animation-height);
    margin-top: var(--snackbar-animation-margin-top);
  }
`, sc = _n`
  from {
    opacity: 1;
    height: var(--snackbar-animation-height);
    margin-top: var(--snackbar-animation-margin-top);
  }
  to {
    opacity: 0;
    height: 0;
    margin-top: 0;
  }
`, cc = ({ disableAnimation: e }) => (t) => I`
      backdrop-filter: blur(32px);
      will-change: backdrop-filter;
      border-radius: 12px;
      margin-top: var(--snackbar-animation-margin-top);
      max-width: 100%;

      ${De(t.breakpoint.sm)} {
        min-width: 356px;
        max-width: 420px;
      }
      ${Ee(t.breakpoint.sm)} {
        width: 100%;
      }

      ${!e && I`
          &[data-status='open'] {
            animation: ${oc} 0.2s ease;
          }
          &[data-status='close'] {
            animation: ${sc} 0.2s ease;
          }
        `}
    `, lc = I`
  border-radius: inherit;
  padding: 11px 16px;
  display: flex;
  gap: 16px;
  font-size: 20px;
  pointer-events: auto;
  align-items: center;
  position: relative;
  overflow: hidden;

  & > :not([role='presentation']) {
    z-index: 1;
  }
`, uc = (e) => I`
  width: 100%;
  height: 100%;
  position: absolute;
  background-color: ${Er(e.semantic.surface.neutral.inverse, e.opacity[52])};
  inset: 0;
`, dc = (e) => I`
  width: 100%;
  height: 100%;
  position: absolute;
  background-color: ${Er(e.semantic.surface.brand.primary, e.opacity[5])};
  inset: 0;
`, fc = I`
  padding: 5px 2px;
`, pc = (e) => I`
  color: ${e.semantic.static.white};
  margin: 0px 2px;
  flex-shrink: 0;

  & > span {
    ${cr("body2", "bold")}
  }

  & [data-component='with-interaction'] {
    background-color: ${e.semantic.background.neutral.primary};
  }
`, mc = (e) => I`
  opacity: ${e.opacity[88]};
  word-break: keep-all;
  overflow-wrap: anywhere;
`, hc = I`
  width: 100%;
`, gc = (e) => I`
  flex-shrink: 0;
  padding: 2px;
  width: fit-content;
  height: fit-content;

  svg {
    opacity: ${e.opacity[61]};
  }

  & [data-component='with-interaction'] {
    background-color: ${e.semantic.background.neutral.primary};
  }
`, _c = (0, _.forwardRef)(({ duration: e = "short", variant: t = "normal", onAnimationEnd: n, defaultOpen: r, open: i, onOpenChange: a, children: o, container: s, disablePortal: c, forceMount: l = !1, disableAnimation: u, as: d, ...f }, p) => {
	let [m, h] = ai({
		prop: i,
		defaultProp: r ?? !1,
		onChange: a
	}), g = (0, _.useId)(), v = (0, _.useId)(), { ref: y, handleAnimationEnd: b, handleMouseEnter: x, handleMouseLeave: S, style: C } = Xs({
		open: m,
		setOpen: h,
		duration: (0, _.useMemo)(() => {
			if (typeof e == "number") return e;
			switch (e) {
				case "long": return 16e3;
				default: return 4e3;
			}
		}, [e]),
		onAnimationEnd: n,
		disablePortal: c,
		component: "snackbar"
	});
	return /* @__PURE__ */ (0, O.jsx)(Te, {
		present: m || l,
		children: /* @__PURE__ */ (0, O.jsx)(da, {
			disablePortal: c,
			container: s ?? globalThis?.document?.querySelector("#montage-region-manager-bottom"),
			children: /* @__PURE__ */ (0, O.jsx)(V, {
				"aria-atomic": !0,
				role: "status",
				"aria-live": "polite",
				"aria-describedby": v,
				"aria-labelledby": g,
				...f,
				as: d ?? "div",
				ref: p,
				onMouseEnter: Kr(f.onMouseEnter, x),
				onMouseLeave: Kr(f.onMouseLeave, S),
				onKeyDown: Kr(f.onKeyDown, (e) => {
					e.key === "Escape" && h(!1);
				}),
				"data-status": m ? "open" : "close",
				onAnimationEnd: b,
				style: {
					...C,
					...f.style
				},
				sx: [cc({ disableAnimation: u }), f.sx],
				children: /* @__PURE__ */ (0, O.jsxs)(V, {
					ref: y,
					sx: lc,
					"data-role": "snackbar",
					children: [
						/* @__PURE__ */ (0, O.jsx)(V, {
							role: "presentation",
							sx: uc
						}),
						/* @__PURE__ */ (0, O.jsx)(V, {
							role: "presentation",
							sx: dc
						}),
						/* @__PURE__ */ (0, O.jsx)(nr, {
							gap: "12px",
							alignItems: "center",
							"data-role": "snackbar-container",
							sx: hc,
							children: /* @__PURE__ */ (0, O.jsx)(ic, {
								headingId: g,
								descriptionId: v,
								variant: t,
								onOpenChange: h,
								children: o
							})
						})
					]
				})
			})
		})
	});
});
_c.displayName = Zs;
var vc = (0, _.forwardRef)(({ extraContent: e, children: t, ...n }, r) => /* @__PURE__ */ (0, O.jsxs)(nr, {
	flex: "1 1 auto",
	gap: "8px",
	alignItems: "center",
	ref: r,
	...n,
	children: [e, /* @__PURE__ */ (0, O.jsx)(nr, {
		flexDirection: "column",
		sx: fc,
		"data-role": "snackbar-content-area",
		children: t
	})]
}));
vc.displayName = Qs;
var yc = (0, _.forwardRef)((e, t) => /* @__PURE__ */ (0, O.jsx)(nr, {
	ref: t,
	flexShrink: 0,
	...e,
	sx: [{
		width: "fit-content",
		height: "fit-content"
	}, e.sx]
}));
yc.displayName = $s;
var bc = (0, _.forwardRef)((e, t) => {
	let { headingId: n } = ac(ec);
	return /* @__PURE__ */ (0, O.jsx)(ur, {
		as: "p",
		id: n,
		ref: t,
		color: "semantic.static.white",
		variant: "body2",
		weight: "bold",
		...e,
		sx: [mc, e.sx]
	});
});
bc.displayName = ec;
var xc = (0, _.forwardRef)((e, t) => {
	let { descriptionId: n } = ac(tc);
	return /* @__PURE__ */ (0, O.jsx)(ur, {
		as: "p",
		id: n,
		ref: t,
		color: "semantic.static.white",
		variant: "label2",
		weight: "regular",
		...e,
		sx: [
			mc,
			lr(2),
			e.sx
		]
	});
});
xc.displayName = tc;
var Sc = (0, _.forwardRef)((e, t) => /* @__PURE__ */ (0, O.jsx)(wi, {
	ref: t,
	color: "assistive",
	size: "medium",
	...e,
	sx: [pc, e.sx]
}));
Sc.displayName = nc;
var Cc = (0, _.forwardRef)(({ children: e, ...t }, n) => {
	let { onOpenChange: r } = ac(rc);
	return /* @__PURE__ */ (0, O.jsx)(Ia, {
		ref: n,
		size: "large",
		interactionOverflow: !0,
		color: "semantic.static.white",
		"aria-label": "Close snackbar",
		...t,
		onClick: Kr(t.onClick, () => r(!1)),
		sx: [gc, t.sx],
		children: e ?? /* @__PURE__ */ (0, O.jsx)(Vr, { "aria-hidden": !0 })
	});
});
Cc.displayName = rc;
// node_modules/@montage-ui/core/dist/components/toast/style.mjs
var wc = _n`
  from {
    opacity: 0;
    height: 0;
    margin-top: 0;
  }
  to {
    opacity: 1;
    height: var(--toast-animation-height);
    margin-top: var(--toast-animation-margin-top);
  }
`, Tc = _n`
  from {
    opacity: 1;
    height: var(--toast-animation-height);
    margin-top: var(--toast-animation-margin-top);
  }
  to {
    opacity: 0;
    height: 0;
    margin-top: 0;
  }
`, Ec = ({ disableAnimation: e }) => (t) => I`
      backdrop-filter: blur(32px);
      will-change: backdrop-filter;
      border-radius: 12px;
      margin-top: var(--toast-animation-margin-top);
      max-width: 100%;

      ${De(t.breakpoint.sm)} {
        min-width: 356px;
        max-width: 420px;
      }
      ${Ee(t.breakpoint.sm)} {
        width: 100%;
      }

      ${!e && I`
          &[data-status='open'] {
            animation: ${wc} 0.2s ease;
          }
          &[data-status='close'] {
            animation: ${Tc} 0.2s ease;
          }
        `}
    `, Dc = I`
  border-radius: inherit;
  padding: 11px 16px;
  display: flex;
  gap: 16px;
  font-size: 20px;
  pointer-events: auto;
  align-items: center;
  position: relative;
  overflow: hidden;

  & > :not([role='presentation']) {
    z-index: 1;
  }
`, Oc = (e) => I`
  width: fit-content;
  height: fit-content;
  position: relative;
  flex-shrink: 0;

  &::before {
    z-index: -1;
    position: absolute;
    content: '';
    width: 8px;
    height: 10px;
    left: 50%;
    top: 50%;
    border-radius: 999px;
    transform: translate(-50%, -50%);
    background-color: ${e.semantic.static.white};
  }
`, kc = (e) => I`
  width: 100%;
  height: 100%;
  position: absolute;
  background-color: ${Er(e.semantic.surface.neutral.inverse, e.opacity[52])};
  inset: 0;
`, Ac = (e) => I`
  width: 100%;
  height: 100%;
  position: absolute;
  background-color: ${Er(e.semantic.surface.brand.primary, e.opacity[5])};
  inset: 0;
`, jc = I`
  padding: 5px 2px;
`, Mc = (e) => I`
  opacity: ${e.opacity[88]};
  word-break: keep-all;
  overflow-wrap: anywhere;
`, Nc = {
	normal: null,
	positive: /* @__PURE__ */ (0, O.jsx)(nr, {
		alignItems: "center",
		justifyContent: "center",
		sx: Oc,
		children: /* @__PURE__ */ (0, O.jsx)(zr, {
			"aria-label": "positive",
			sx: (e) => ({ color: e.atomic.green[60] })
		})
	}),
	cautionary: /* @__PURE__ */ (0, O.jsx)(nr, {
		alignItems: "center",
		justifyContent: "center",
		sx: Oc,
		children: /* @__PURE__ */ (0, O.jsx)(Hr, {
			"aria-label": "cautionary",
			sx: (e) => ({ color: e.atomic.orange[60] })
		})
	}),
	negative: /* @__PURE__ */ (0, O.jsx)(nr, {
		alignItems: "center",
		justifyContent: "center",
		sx: Oc,
		children: /* @__PURE__ */ (0, O.jsx)(Br, {
			"aria-label": "negative",
			sx: (e) => ({ color: e.atomic.red[60] })
		})
	})
}, Pc = "Toast", Fc = "ToastContainer", Ic = "ToastContent", Lc = "ToastIcon", [Rc, zc] = Ir(Pc), Bc = (0, _.forwardRef)(({ duration: e = "short", variant: t = "normal", onAnimationEnd: n, defaultOpen: r, open: i, onOpenChange: a, children: o, container: s, disablePortal: c, disableAnimation: l, forceMount: u, as: d, ...f }, p) => {
	let [m, h] = ai({
		defaultProp: r ?? !1,
		prop: i,
		onChange: a
	}), g = (0, _.useId)(), { ref: v, handleAnimationEnd: y, handleMouseEnter: b, handleMouseLeave: x, style: S } = Xs({
		open: m,
		setOpen: h,
		duration: (0, _.useMemo)(() => {
			if (typeof e == "number") return e;
			switch (e) {
				case "long": return 5e3;
				default: return 3e3;
			}
		}, [e]),
		onAnimationEnd: n,
		disablePortal: c,
		component: "toast"
	}), C = (0, _.useMemo)(() => t === "negative" ? {
		role: "alert",
		"aria-live": "assertive"
	} : {
		role: t === "cautionary" ? "alert" : "status",
		"aria-live": "polite"
	}, [t]);
	return /* @__PURE__ */ (0, O.jsx)(Te, {
		present: m || u,
		children: /* @__PURE__ */ (0, O.jsx)(da, {
			disablePortal: c,
			container: s ?? globalThis?.document?.querySelector("#montage-region-manager-bottom"),
			children: /* @__PURE__ */ (0, O.jsx)(V, {
				"aria-atomic": !0,
				...C,
				"aria-describedby": g,
				ref: p,
				...f,
				as: d ?? "div",
				onMouseEnter: Kr(f.onMouseEnter, b),
				onMouseLeave: Kr(f.onMouseLeave, x),
				"data-status": m ? "open" : "close",
				onAnimationEnd: y,
				style: {
					...S,
					...f.style
				},
				sx: [Ec({ disableAnimation: l }), f.sx],
				children: /* @__PURE__ */ (0, O.jsxs)(V, {
					ref: v,
					sx: Dc,
					"data-role": "toast",
					children: [
						/* @__PURE__ */ (0, O.jsx)(V, {
							role: "presentation",
							sx: kc
						}),
						/* @__PURE__ */ (0, O.jsx)(V, {
							role: "presentation",
							sx: Ac
						}),
						/* @__PURE__ */ (0, O.jsx)(Rc, {
							contentId: g,
							variant: t,
							children: o
						})
					]
				})
			})
		})
	});
});
Bc.displayName = Pc;
var Vc = (0, _.forwardRef)((e, t) => /* @__PURE__ */ (0, O.jsx)(nr, {
	gap: "8px",
	alignItems: "center",
	ref: t,
	...e,
	sx: [{ "& svg": { flexShrink: 0 } }, e.sx]
}));
Vc.displayName = Fc;
var Hc = (0, _.forwardRef)(({ children: e, ...t }, n) => {
	let { variant: r } = zc(Lc), i = e || Nc[r];
	return i ? /* @__PURE__ */ (0, O.jsx)(ce, {
		ref: n,
		...t,
		children: i
	}) : null;
});
Hc.displayName = Lc;
var Uc = (0, _.forwardRef)((e, t) => {
	let { contentId: n } = zc(Ic);
	return /* @__PURE__ */ (0, O.jsx)(ur, {
		as: "p",
		color: "semantic.static.white",
		variant: "body2",
		weight: "bold",
		id: n,
		ref: t,
		...e,
		sx: [
			jc,
			Mc,
			e.sx
		]
	});
});
Uc.displayName = Ic;
// node_modules/@montage-ui/core/dist/theme-provider/cookie-theme-provider/constants.mjs
var Wc = "data-theme", Gc = "data-montage-theme-script", Kc = "(prefers-color-scheme: dark)", qc = "montage-theme", Jc = 31536e3, Yc = "__montage-theme-probe", Xc = "__Host-", Zc = {
	lax: "Lax",
	strict: "Strict",
	none: "None"
}, Qc = [
	"lax",
	"strict",
	"none"
], $c = (e) => ({
	requireSecure: e.startsWith("__Secure-") || e.startsWith("__Host-"),
	requireHostOnly: e.startsWith(Xc)
}), el = (e) => {
	if (e !== void 0 && (!Number.isInteger(e) || e <= 0)) console.error("[Montage] ThemeProvider cookie.maxAge must be a positive integer number of seconds. The option was ignored.");
	else return e;
}, tl = (e) => {
	if (e !== void 0 && !Qc.includes(e)) console.error(`[Montage] ThemeProvider cookie.sameSite must be one of ${Qc.join(", ")}. The option was ignored.`);
	else return e;
}, nl = (e) => {
	e && typeof window < "u" && window.isSecureContext === !1 && console.error("[Montage] ThemeProvider is writing a Secure theme cookie from an insecure context, so the browser will drop it. Serve the page over HTTPS, or avoid sameSite \"none\" and the __Secure-/__Host- cookie name prefixes here.");
}, rl = (e) => e === "light" || e === "dark" || e === "system", il = (e) => {
	for (let t = 0; t < e.length; t += 1) {
		let n = e.charCodeAt(t);
		if (n === 59 || n <= 31 || n === 127) return !0;
	}
	return !1;
}, al = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/, ol = (e) => {
	if (e !== void 0 && !al.test(e)) console.error("[Montage] ThemeProvider cookie.key must be a valid cookie name (RFC 6265 token). The option was ignored.");
	else return e;
}, sl = (e, t) => {
	if (t !== void 0 && il(t)) console.error(`[Montage] ThemeProvider cookie.${e} must not contain ';' or control characters. The option was ignored.`);
	else return t;
}, cl = (e) => {
	try {
		return decodeURIComponent(e);
	} catch {
		return e;
	}
}, ll = () => {
	try {
		return document.cookie;
	} catch {
		return "";
	}
}, ul = (e) => {
	try {
		document.cookie = e;
	} catch {}
}, dl = (e) => ll().split("; ").filter((t) => t.slice(0, t.indexOf("=")) === e).map((e) => cl(e.slice(e.indexOf("=") + 1))), fl = (e) => dl(e)[0], pl = (e) => {
	let t = sl("path", e);
	if (t !== void 0 && !t.startsWith("/")) console.error("[Montage] ThemeProvider cookie.path must be an absolute path starting with \"/\". The option was ignored.");
	else return t;
}, ml = (e) => {
	let t = e.filter(rl), [n] = t;
	return n !== void 0 && t.every((e) => e === n) ? n : void 0;
}, hl = (e) => {
	if (typeof document < "u") return ml(dl(e));
}, gl = (e) => !e.includes(".") || e.startsWith("[") || /^[\d.]+$/.test(e), _l = (e) => {
	ul(`${Yc}=1; Path=/; Domain=${e}; SameSite=Lax`);
	let t = fl(Yc) !== void 0;
	return t && ul(`${Yc}=; Path=/; Domain=${e}; Max-Age=0`), t;
}, vl = (e) => {
	let t = e.split(".");
	for (let e = t.length - 2; e >= 0; --e) {
		let n = `.${t.slice(e).join(".")}`;
		if (_l(n)) return n;
	}
}, yl = /* @__PURE__ */ new Map(), bl = () => {
	if (typeof document > "u" || typeof window > "u") return;
	let { hostname: e } = window.location;
	if (yl.has(e)) return yl.get(e);
	let t = gl(e) ? void 0 : vl(e);
	return yl.set(e, t), t;
}, xl = (e) => {
	if (e !== "none") return e === void 0 || e === "auto" ? bl() : sl("domain", e);
}, Sl = (e) => {
	let t = /* @__PURE__ */ new Set(["/", e]);
	if (typeof window < "u") {
		let e = "";
		for (let n of window.location.pathname.split("/").filter(Boolean)) e += `/${n}`, t.add(e);
	}
	return [...t];
}, Cl = (e) => $c(e).requireSecure ? "; Secure" : "", wl = (e, t = "/") => {
	if (typeof document > "u") return;
	let n = Cl(e);
	for (let r of Sl(t)) ul(`${e}=; Path=${r}; Max-Age=0${n}`);
}, Tl = (e, { key: t = qc, domain: n, path: r = "/", maxAge: i = Jc, sameSite: a = "lax", secure: o = a === "none" } = {}) => {
	let s = [
		`${t}=${encodeURIComponent(e)}`,
		`Path=${r}`,
		`Max-Age=${i}`,
		`SameSite=${Zc[a]}`
	];
	return n && s.push(`Domain=${n}`), o && s.push("Secure"), s.join("; ");
}, El = (e, t = {}) => {
	typeof document < "u" && ul(Tl(e, t));
}, Dl = () => typeof window > "u" ? void 0 : window.cookieStore, Ol = (e) => e.replace(/^\./, "").toLowerCase(), kl = (e, t) => {
	let n = e.domain ?? void 0;
	return (t.domain === void 0 ? n === void 0 : n !== void 0 && Ol(n) === Ol(t.domain)) && (e.path ?? "/") === t.path;
}, Al = async (e, t) => {
	let n = await e.getAll(t.key), r = n.find((e) => kl(e, t)), i = r?.value;
	return {
		own: rl(i) ? i : void 0,
		strays: n.filter((e) => e !== r)
	};
}, jl = (e, t) => {
	if (typeof document > "u") return;
	let n = [
		`${e}=`,
		`Path=${t.path ?? "/"}`,
		"Max-Age=0"
	];
	t.domain && n.push(`Domain=${t.domain}`), ul(n.join("; ") + Cl(e));
}, Ml = () => {
	if (typeof window < "u") return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}, Nl = (e) => {
	if (typeof document > "u") return () => {};
	let t = document.createElement("style");
	return e && t.setAttribute("nonce", e), t.appendChild(document.createTextNode("*,*::before,*::after{transition:none!important}")), document.head.appendChild(t), () => {
		window.getComputedStyle(document.body), setTimeout(() => {
			document.head.removeChild(t);
		}, 1);
	};
}, Pl = ({ key: e, domain: t, path: n, maxAge: r, sameSite: i, secure: a } = {}) => {
	let o = ol(e) ?? "montage-theme", { requireSecure: s, requireHostOnly: c } = $c(o);
	t === "none" && o === "montage-theme" && console.error("[Montage] ThemeProvider cookie.domain \"none\" only stops this app from writing a shared cookie — a cookie of the same name written by another app under the same root domain is still sent here, and would be copied into this app's host-only cookie and then never updated again. Give this app its own cookie.key as well.");
	let l = pl(n) ?? "/";
	c && t !== "none" && console.error(`[Montage] ThemeProvider cookie.key "${o}" uses the __Host- prefix, which forbids a Domain attribute. The theme is stored host-only and is NOT shared across subdomains.`), c && l !== "/" && console.error(`[Montage] ThemeProvider cookie.key "${o}" uses the __Host- prefix, which pins Path to "/". cookie.path was ignored.`), s && a === !1 && console.error(`[Montage] ThemeProvider cookie.key "${o}" requires the Secure attribute. cookie.secure=false was ignored.`);
	let u = tl(i), d = u === "none";
	d && a === !1 && console.error("[Montage] ThemeProvider cookie.sameSite \"none\" requires the Secure attribute. cookie.secure=false was ignored.");
	let f = c ? void 0 : xl(t), p = {
		key: o,
		domain: f,
		domainScoped: !c && (t === void 0 || t === "auto" || f !== void 0),
		path: c ? "/" : l,
		maxAge: el(r),
		sameSite: u,
		secure: s || d || a
	};
	return nl(!!p.secure), p;
}, Fl = () => {
	if (typeof document > "u" || document.documentElement.hasAttribute("data-theme")) return !1;
	let e = document.querySelector(`script[${Gc}]`);
	return e instanceof HTMLScriptElement && e.type === "";
}, Il = (e, t) => {
	e && console.error(`[Montage] The ThemeProvider inline script did not run, so the first paint used the default theme instead of the stored one. A Content-Security-Policy that blocks inline scripts is the usual cause — ${t ? "verify that the `nonce` passed to ThemeProvider matches the one in the CSP header." : "pass ThemeProvider a `nonce` matching the one in the CSP header."}`);
}, Ll = ({ cookieKey: e, cookiePath: t, domainScoped: n, defaultTheme: r, forcedTheme: i, enableSystem: a }) => {
	let o = `d.setAttribute('${Wc}',t);d.style.colorScheme=t`;
	if (i) return `!function(){try{var d=document.documentElement,t=${JSON.stringify(i)};${o}}catch(e){}}()`;
	let s = a ? `if(t==='system')t=window.matchMedia('${Kc}').matches?'dark':'light';` : "if(t==='system')t='light';", c = [.../* @__PURE__ */ new Set(["/", t])], l = $c(e).requireSecure ? "; Secure" : "", u = n ? `if(t===null){var y=${JSON.stringify(c)},z='';location.pathname.split('/').forEach(function(s){if(s){y.push(z+='/'+s)}});y.forEach(function(a){document.cookie=k+'=; Path='+a+'; Max-Age=0${l}'});t=g()}` : "";
	return `!function(){try{var d=document.documentElement,k=${JSON.stringify(e)},g=function(){var p=document.cookie.split('; '),r;for(var i=0;i<p.length;i++){var c=p[i],x=c.indexOf('=');if(c.slice(0,x)===k){var v=c.slice(x+1);try{v=decodeURIComponent(v)}catch(e){}if(v==='light'||v==='dark'||v==='system'){if(r!==undefined&&r!==v)return null;r=v}}}return r},t=g();` + u + `if(t!=='light'&&t!=='dark'&&t!=='system')t=${JSON.stringify(r)};` + s + o + "}catch(e){}}()";
}, Rl = (0, _.memo)(({ nonce: e, ...t }) => {
	let n = typeof window > "u" ? void 0 : { type: "application/json" };
	return /* @__PURE__ */ (0, O.jsx)("script", {
		suppressHydrationWarning: !0,
		[Gc]: "",
		nonce: e,
		...n,
		dangerouslySetInnerHTML: { __html: Ll(t) }
	});
});
Rl.displayName = "ThemeScript";
// node_modules/@montage-ui/core/dist/theme-provider/cookie-theme-provider/index.mjs
var zl = ({ children: e, enableSystem: t, disableTransitionOnChange: n, forcedTheme: r, cookie: i, nonce: a }) => {
	let { key: o, domain: s, path: c, maxAge: l, sameSite: u, secure: d } = i ?? {}, f = (0, _.useMemo)(() => Pl({
		key: o,
		domain: s,
		path: c,
		maxAge: l,
		sameSite: u,
		secure: d
	}), [
		o,
		s,
		c,
		l,
		u,
		d
	]), { key: p, domain: m, domainScoped: h, path: g } = f, v = t ? "system" : "light", [y, b] = (0, _.useState)(() => {
		if (!m || r) return hl(p);
		let e = hl(p);
		wl(p, g);
		let t = hl(p);
		return t === void 0 && e !== void 0 && El(e, f), t ?? e;
	}), [x, S] = (0, _.useState)(Ml), C = (0, _.useRef)(Fl());
	(0, _.useEffect)(() => {
		Il(C.current, a);
	}, [a]);
	let ee = y ?? v, w = r ?? (ee === "system" ? x : ee), te = (0, _.useRef)(f);
	te.current = f;
	let T = (0, _.useCallback)((e) => {
		b((t) => {
			let n = typeof e == "function" ? e(t ?? v) : e;
			return rl(n) ? n : t;
		});
	}, [v]), ne = (0, _.useRef)(0);
	return (0, _.useEffect)(() => {
		y && !r && (ne.current += 1, El(y, te.current));
	}, [y, r]), (0, _.useEffect)(() => {
		if (!w) return;
		let e = n ? Nl(a) : void 0;
		document.documentElement.setAttribute(Wc, w), document.documentElement.style.colorScheme = w, e?.();
	}, [
		w,
		n,
		a
	]), (0, _.useEffect)(() => {
		if (!t || typeof window > "u") return;
		let e = window.matchMedia(Kc), n = () => {
			S(e.matches ? "dark" : "light");
		};
		return n(), e.addEventListener("change", n), () => {
			e.removeEventListener("change", n);
		};
	}, [t]), (0, _.useEffect)(() => {
		if (typeof window > "u") return;
		let e = {
			key: p,
			domain: m,
			path: g
		}, t = !!m && !r, n = Dl(), i = !1, a = () => {
			let e = hl(p);
			e && b(e);
		}, o = async (n) => {
			let r = ne.current, o;
			try {
				o = await Al(n, e);
			} catch {
				a();
				return;
			}
			i || r !== ne.current || (o.own && b(o.own), t && o.strays.forEach((e) => {
				jl(p, e);
			}));
		}, s = n ? () => {
			o(n);
		} : a, c = () => {
			document.visibilityState === "visible" && s();
		}, l = (e) => {
			let { changed: t = [], deleted: n = [] } = e, r = [...t, ...n];
			(r.length === 0 || r.some((e) => e.name === p)) && s();
		};
		return n && s(), n?.addEventListener("change", l), document.addEventListener("visibilitychange", c), window.addEventListener("focus", s), () => {
			i = !0, n?.removeEventListener("change", l), document.removeEventListener("visibilitychange", c), window.removeEventListener("focus", s);
		};
	}, [
		p,
		m,
		g,
		r
	]), /* @__PURE__ */ (0, O.jsxs)(fa, {
		theme: typeof document > "u" ? void 0 : ee,
		resolvedTheme: w,
		systemTheme: x,
		forcedTheme: r,
		setTheme: T,
		nonce: a,
		children: [/* @__PURE__ */ (0, O.jsx)(Rl, {
			cookieKey: p,
			cookiePath: g,
			domainScoped: h,
			defaultTheme: v,
			forcedTheme: r,
			enableSystem: t,
			nonce: a
		}), e]
	});
}, Bl = () => /* @__PURE__ */ (0, O.jsx)(O.Fragment, { children: Hs((e) => e.items).map((e) => /* @__PURE__ */ (0, O.jsx)(Vl, { ...e }, e.id)) }), Vl = ({ id: e, content: t, title: n, confirm: r, cancel: i, direction: a = "normal", disableOutsideClickClose: o, disableEscapeKeyDownClose: s, sx: c, resolve: l }) => {
	let u = Hs((e) => e.hide), d = (0, _.useCallback)(() => {
		u(e);
	}, [u, e]), f = (0, _.useCallback)((e) => {
		e?.defaultPrevented || (d(), l("cancel"));
	}, [d, l]), p = (0, _.useCallback)((e) => {
		e?.defaultPrevented || (d(), l("confirm"));
	}, [d, l]);
	return /* @__PURE__ */ (0, O.jsx)(Ts, {
		open: !0,
		onOpenChange: (e) => !e && f(),
		children: /* @__PURE__ */ (0, O.jsxs)(Os, {
			disableOutsideClickClose: o,
			disableEscapeKeyDownClose: s,
			sx: c,
			children: [/* @__PURE__ */ (0, O.jsxs)(ks, { children: [n && /* @__PURE__ */ (0, O.jsx)(As, { children: n }), t && /* @__PURE__ */ (0, O.jsx)(js, { children: t })] }), /* @__PURE__ */ (0, O.jsxs)(Ms, {
				flexDirection: a === "reverse" ? "row-reverse" : "row",
				justifyContent: a === "reverse" ? "initial" : "flex-end",
				children: [/* @__PURE__ */ (0, O.jsx)(ce, {
					onClick: p,
					children: /* @__PURE__ */ (0, O.jsx)(de, { children: r })
				}), !!i && /* @__PURE__ */ (0, O.jsx)(ce, {
					onClick: f,
					children: /* @__PURE__ */ (0, O.jsx)(de, { children: i })
				})]
			})]
		})
	});
}, Hl = (e) => e.type === "snackbar", Ul = () => {
	let e = Ks((e) => e.config), t = Ks((e) => e.items);
	return /* @__PURE__ */ (0, O.jsxs)(O.Fragment, { children: [/* @__PURE__ */ (0, O.jsx)(V, {
		"data-ignore-dismissable-layer": "true",
		style: {
			"--region-viewport-max-width": `calc(${e.viewportMaxWidth})`,
			"--region-viewport-bottom": `calc(env(safe-area-inset-bottom, 0px) + ${e.viewportBottom})`
		},
		role: "region",
		"aria-live": "polite",
		id: "montage-region-manager",
		"aria-label": "Notifications",
		children: /* @__PURE__ */ (0, O.jsx)(V, {
			id: "montage-region-manager-bottom",
			sx: (e) => ({
				position: "fixed",
				zIndex: 5500,
				justifyContent: "center",
				pointerEvents: "none",
				width: "fit-content",
				minWidth: "100px",
				alignItems: "center",
				display: "flex",
				flexDirection: "column",
				maxWidth: "var(--region-viewport-max-width, 100%)",
				padding: "20px",
				left: "50%",
				transform: "translateX(-50%)",
				bottom: "var(--region-viewport-bottom, 0px)",
				paddingBottom: "40px",
				[`@media (max-width: ${e.breakpoint.sm})`]: {
					minWidth: "100%",
					paddingBottom: "20px"
				}
			})
		})
	}), t.map((e) => Hl(e) ? /* @__PURE__ */ (0, O.jsx)(Wl, { item: e }, e.id) : /* @__PURE__ */ (0, O.jsx)(Gl, { item: e }, e.id))] });
}, Wl = ({ item: e }) => {
	let t = Ks((e) => e.remove), n = Ks((e) => e.hide);
	return /* @__PURE__ */ (0, O.jsxs)(_c, {
		variant: e.variant,
		duration: e.duration,
		onAnimationEnd: (n) => {
			e.onAnimationEnd?.(n), n === "hide" && t(e.id);
		},
		onOpenChange: (t) => {
			t || n(e.id);
		},
		open: e.visibility === "visible",
		children: [
			/* @__PURE__ */ (0, O.jsxs)(vc, {
				extraContent: e.extraContent && /* @__PURE__ */ (0, O.jsx)(yc, { children: e.extraContent }),
				children: [!!e.title && /* @__PURE__ */ (0, O.jsx)(bc, { children: e.title }), !!e.description && /* @__PURE__ */ (0, O.jsx)(xc, { children: e.description })]
			}),
			!!e.action && Object.keys(e.action).length > 0 && /* @__PURE__ */ (0, O.jsx)(Sc, { ...e.action }),
			!!e.closeButton && /* @__PURE__ */ (0, O.jsx)(Cc, {})
		]
	}, e.id);
}, Gl = ({ item: e }) => {
	let t = Ks((e) => e.remove), n = Ks((e) => e.hide);
	return /* @__PURE__ */ (0, O.jsx)(Bc, {
		variant: e.variant,
		duration: e.duration,
		onAnimationEnd: (n) => {
			e.onAnimationEnd?.(n), n === "hide" && t(e.id);
		},
		onOpenChange: (t) => {
			t || n(e.id);
		},
		open: e.visibility === "visible",
		children: /* @__PURE__ */ (0, O.jsxs)(Vc, { children: [/* @__PURE__ */ (0, O.jsx)(Hc, { children: e.icon }), /* @__PURE__ */ (0, O.jsx)(Uc, { children: e.content })] })
	});
}, Kl = ({ children: e }) => {
	let t = (0, _.useRef)(void 0), n = (0, _.useRef)(void 0);
	return t.current ||= Ws(), n.current ||= Bs(), /* @__PURE__ */ (0, O.jsx)(Vs.Provider, {
		value: n.current,
		children: /* @__PURE__ */ (0, O.jsxs)(Gs.Provider, {
			value: t.current,
			children: [
				e,
				/* @__PURE__ */ (0, O.jsx)(Ul, {}),
				/* @__PURE__ */ (0, O.jsx)(Bl, {})
			]
		})
	});
}, ql = ({ children: e, enableDarkMode: t, disableTransitionOnChange: n = !1, cookie: r, disableDefaultGlobalStyle: i = !1, provider: a, nonce: o }) => /* @__PURE__ */ (0, O.jsx)(zl, {
	enableSystem: t || !1,
	disableTransitionOnChange: n,
	forcedTheme: t ? void 0 : "light",
	cookie: r,
	nonce: o,
	children: /* @__PURE__ */ (0, O.jsx)(Jl, {
		disableDefaultGlobalStyle: i,
		provider: a,
		children: e
	})
}), Jl = ({ children: e, disableDefaultGlobalStyle: t, provider: n }) => {
	let { theme: r } = Js();
	return /* @__PURE__ */ (0, O.jsxs)(qn, {
		theme: r,
		provider: n,
		children: [/* @__PURE__ */ (0, O.jsx)(Kl, { children: e }), /* @__PURE__ */ (0, O.jsx)(Kn, { styles: t ? void 0 : (e) => ({ body: { backgroundColor: e.semantic.background.neutral.primary } }) })]
	});
}, Yl;
function Xl() {
	return Yl || (Yl = new Promise((e, t) => {
		let n = document.createElement("link");
		n.rel = "stylesheet", n.href = "/montage/tokens.css";
		let r = setTimeout(i, 5e3);
		function i() {
			clearTimeout(r), n.onload = n.onerror = null, n.remove(), Yl = null, t(/* @__PURE__ */ Error("Montage 스타일을 불러오지 못했습니다."));
		}
		n.onload = () => {
			clearTimeout(r), n.onload = n.onerror = null, e();
		}, n.onerror = i, document.head.append(n);
	}), Yl);
}
export { u as A, yn as C, ie as D, E, g as O, V as S, k as T, cr as _, bi as a, Zn as b, Br as c, Fr as d, Ar as f, ur as g, hr as h, pa as i, c as j, m as k, zr as l, Nr as m, ql as n, ai as o, Or as p, Ia as r, Kr as s, Xl as t, Ir as u, nr as v, I as w, $n as x, Yn as y };
