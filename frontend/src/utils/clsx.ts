function toVal(mix: string | number | Record<string, any>): string {
	let str = "";

	if (typeof mix === "string" || typeof mix === "number") {
		str += mix;
	} else if (typeof mix === "object") {
		if (Array.isArray(mix)) {
			const len = mix.length;
			for (let k = 0; k < len; k++) {
				if (mix[k]) {
					const y = toVal(mix[k]);
					if (y) {
						str && (str += " ");
						str += y;
					}
				}
			}
		} else {
			for (const y in mix) {
				if (mix[y]) {
					str && (str += " ");
					str += y;
				}
			}
		}
	}

	return str;
}

export function clsx(...args: Array<string | number | Record<string, any>>): string {
	let str = "";
	const len = args.length;

	for (let i = 0; i < len; i++) {
		const tmp = args[i];
		if (tmp) {
			const x = toVal(tmp);
			if (x) {
				str && (str += " ");
				str += x;
			}
		}
	}

	return str;
}

export default clsx;
