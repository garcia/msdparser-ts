/** Used to prove exhaustive conditionals */
export function absurd(_: never): never {
    throw new Error();
}