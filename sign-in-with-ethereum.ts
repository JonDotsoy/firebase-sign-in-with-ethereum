import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, User, UserCredential } from "firebase/auth";

const isObject = (obj: any): obj is Record<any, any> => typeof obj === "object" && obj !== null;
const isGlobalThisEthereum = (obj: any): obj is { ethereum: { request: <R = any>(payload: Record<any, any>) => Promise<R> } } => isObject(obj) && isObject(obj.ethereum) && typeof obj.ethereum.request === "function";
const getEthereum = (obj: any) => isGlobalThisEthereum(obj) ? obj.ethereum : null;

const ethereum = getEthereum(globalThis);

let signMessage = (opts: { siteName: string, address: string }) =>
    `${opts.siteName} wants you to sign in with your Ethereum account:\n${opts.address}`

export async function signInWithEthereum(auth: Auth, opts?: { siteName?: string }): Promise<UserCredential> {
    if (!ethereum) {
        throw new Error("No ethereum provider found");
    }

    const [account] = await ethereum.request<string[]>({ method: "eth_requestAccounts" });

    if (!account) {
        throw new Error("No account found");
    }

    const signed = await ethereum.request<string>({
        method: 'personal_sign',
        params: [
            signMessage({
                siteName: opts?.siteName ?? auth.app.options.projectId ?? globalThis.location.hostname,
                address: account,
            }),
            account,
            auth.app.options.appId,
        ],
    });

    let fragment = signed.slice(-10);

    const email = `${account}.${fragment}.3@${auth.app.options.authDomain}`;
    const password = signed;

    let userCredential: UserCredential;
    let user: User;

    try {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        user = userCredential.user;
    } catch (e) {
        const isAuthUserNotFound = (e: any) => typeof e === "object" && e !== null && e.hasOwnProperty("code") && e.code === "auth/user-not-found"
        if (isAuthUserNotFound(e)) {
            userCredential = await createUserWithEmailAndPassword(auth, email, password);
            user = userCredential.user;
        } else {
            throw e;
        }
    }

    if (!user.displayName) {
        await updateProfile(user, {
            displayName: account,
        });
    }

    return userCredential;
}
