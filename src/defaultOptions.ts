export function defaultOptions(options?: VFSHTTP.Options): VFSHTTP.Options {
  return {
    timeout: options?.timeout ?? 20000,
    maxPageSize: options?.maxPageSize ?? 4096
  }
}
