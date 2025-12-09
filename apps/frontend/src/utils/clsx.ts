/**
 * Converts a value to a space-separated string of class names
 * @param mix - A string, number, or object containing class names
 * @returns A space-separated string of class names
 */
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

/**
 * A utility function for constructing className strings conditionally.
 * Combines multiple class names, conditionally includes them based on truthy values,
 * and handles various input types (strings, numbers, arrays, objects).
 *
 * @param args - Any number of arguments that can be strings, numbers, arrays, or objects
 * @returns A single space-separated string of class names
 *
 * @example
 * clsx('foo', 'bar') // => 'foo bar'
 * clsx('foo', { bar: true, baz: false }) // => 'foo bar'
 * clsx({ 'foo-bar': true }) // => 'foo-bar'
 * clsx(['foo', 'bar']) // => 'foo bar'
 * clsx('foo', null, undefined, 'bar') // => 'foo bar'
 */
export function clsx(...args: Array<string | number | undefined | Record<string, any>>): string {
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
