import * as React from "react";

type PossibleRef<T> = React.Ref<T> | undefined;

function setRef<T>(ref: PossibleRef<T>, value: T) {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref !== null && ref !== undefined) {
    (ref as React.MutableRefObject<T>).current = value;
  }
}

export function useComposedRefs<T>(...refs: PossibleRef<T>[]) {
  return React.useCallback((node: T) => {
    refs.forEach((ref) => setRef(ref, node));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, refs);
}
