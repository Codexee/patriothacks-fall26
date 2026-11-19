// earcut 2.x has no type file. deck.gl installs it.
declare module 'earcut' {
  export default function earcut(data: ArrayLike<number>, holeIndices?: ArrayLike<number> | null, dim?: number): number[];
}
