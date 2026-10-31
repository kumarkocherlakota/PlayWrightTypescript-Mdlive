export type DeepPartial<T> = T extends readonly (infer Item)[]
  ? readonly Item[]
  : T extends object
    ? { [Key in keyof T]?: DeepPartial<T[Key]> }
    : T;
