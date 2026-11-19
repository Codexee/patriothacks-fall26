// Evaluator for the ModelFile format in contracts/README.md.
// It walks the trees from LightGBM `booster.dump_model()["tree_info"]` and gives the same number
// as `booster.predict()`. The rules below copy LightGBM's `Tree::NumericalDecision`.

import type { ModelFile } from '../contracts.ts';

interface Leaf {
  leaf_value: number;
}
interface Split {
  split_feature: number;
  threshold: number;
  decision_type: string;
  default_left: boolean;
  missing_type: 'None' | 'Zero' | 'NaN';
  left_child: TreeNode;
  right_child: TreeNode;
}
type TreeNode = Leaf | Split;

/** LightGBM treats a value this close to zero as zero (kZeroThreshold). */
const ZERO = 1e-35;

const isSplit = (n: TreeNode): n is Split => (n as Split).left_child !== undefined;

function treeValue(root: TreeNode, x: readonly (number | null | undefined)[]): number {
  let node = root;
  while (isSplit(node)) {
    if (node.decision_type !== '<=') {
      throw new Error(`Split type "${node.decision_type}" is not supported (numerical "<=" only).`);
    }
    const raw = x[node.split_feature];
    let v = raw == null ? NaN : raw;
    const missing = node.missing_type;
    // A missing input counts as zero unless the split has its own rule for NaN.
    if (Number.isNaN(v) && missing !== 'NaN') v = 0;
    const useDefault =
      (missing === 'Zero' && v >= -ZERO && v <= ZERO) || (missing === 'NaN' && Number.isNaN(v));
    const left = useDefault ? node.default_left : v <= node.threshold;
    node = left ? node.left_child : node.right_child;
  }
  return node.leaf_value;
}

/** Sum of the leaf values over all trees (the raw score). */
export function predictRaw(model: ModelFile, x: readonly (number | null | undefined)[]): number {
  let sum = 0;
  for (const t of model.trees as { tree_structure: TreeNode }[]) sum += treeValue(t.tree_structure, x);
  return sum;
}

/** Model output: a probability for "binary", the raw sum for "regression". `null` = missing. */
export function predict(model: ModelFile, x: readonly (number | null | undefined)[]): number {
  const raw = predictRaw(model, x);
  return model.objective === 'binary' ? 1 / (1 + Math.exp(-raw)) : raw;
}

/** Largest difference between this evaluator and the Python predictions stored in the file. */
export function parityError(model: ModelFile): { maxAbsDiff: number; rows: number } {
  let maxAbsDiff = 0;
  for (const row of model.parity) maxAbsDiff = Math.max(maxAbsDiff, Math.abs(predict(model, row.x) - row.p));
  return { maxAbsDiff, rows: model.parity.length };
}

/** True when the object has the fields of a ModelFile (used after a fetch that can return anything). */
export function isModelFile(v: unknown): v is ModelFile {
  const m = v as ModelFile | null;
  return !!m && Array.isArray(m.trees) && Array.isArray(m.features) && typeof m.objective === 'string';
}
