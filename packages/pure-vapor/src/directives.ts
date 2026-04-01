import { isBuiltInDirective } from "@vue/shared";
import { warn } from "./warning";

export function validateDirectiveName(name: string): void {
    if (isBuiltInDirective(name)) {
        warn('Do not use built-in directive ids as custom directive id: ' + name)
    }
}