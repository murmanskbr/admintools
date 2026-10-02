const PASSWORD_ITERATIONS = 210000;

function bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

function hexToBytes(hex: string): Uint8Array {
    if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
        throw new Error("INVALID_HEX");
    }

    const result = new Uint8Array(hex.length / 2);

    for (let i = 0; i < hex.length; i += 2) {
        result[i / 2] = parseInt(hex.slice(i, i + 2), 16);
    }

    return result;
}

export async function sha256(value: string): Promise<string> {
    const data = new TextEncoder().encode(value);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return bytesToHex(new Uint8Array(hash));
}

export async function hashPassword(password: string): Promise<string> {
    const salt = crypto.getRandomValues(new Uint8Array(16));

    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const derived = await crypto.subtle.deriveBits(
        {
            name: "PBKDF2",
            salt,
            iterations: PASSWORD_ITERATIONS,
            hash: "SHA-256"
        },
        key,
        256
    );

    return `${bytesToHex(salt)}:${bytesToHex(new Uint8Array(derived))}`;
}

export async function verifyPassword(
    password: string,
    storedHash: string
): Promise<boolean> {
    const parts = storedHash.split(":");

    if (parts.length !== 2) {
        return false;
    }

    const salt = hexToBytes(parts[0]);
    const expected = hexToBytes(parts[1]);

    const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits"]
    );

    const derived = new Uint8Array(
        await crypto.subtle.deriveBits(
            {
                name: "PBKDF2",
                salt,
                iterations: PASSWORD_ITERATIONS,
                hash: "SHA-256"
            },
            key,
            256
        )
    );

    if (expected.length !== derived.length) {
        return false;
    }

    let diff = 0;

    for (let i = 0; i < expected.length; i++) {
        diff |= expected[i] ^ derived[i];
    }

    return diff === 0;
}

export function generateToken(): string {
    return bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
}
