(function () {
    "use strict";

    var API_URL =
        "https://sszzxumaxchriusshfsn.supabase.co/functions/v1/veb-tools";

    function getDeviceId() {
        var key = "br_device_id";
        var value = localStorage.getItem(key);

        if (value) {
            return value;
        }

        value =
            window.crypto &&
            crypto.randomUUID
                ? crypto.randomUUID()
                : "web-" +
                  Date.now() +
                  "-" +
                  Math.random()
                      .toString(16)
                      .slice(2);

        localStorage.setItem(
            key,
            value
        );

        return value;
    }

    async function request(
        payload,
        token
    ) {
        var headers = {
            "Content-Type":
                "application/json"
        };

        if (token) {
            headers.Authorization =
                "Bearer " + token;
        }

        var response;

        try {
            response =
                await fetch(
                    API_URL,
                    {
                        method: "POST",
                        headers: headers,
                        body:
                            JSON.stringify(
                                payload
                            )
                    }
                );
        } catch (networkError) {
            console.error(
                "[BR AdminTools] Ошибка соединения с сервером:",
                networkError
            );

            var error =
                new Error(
                    "Ошибка сервера: не удалось подключиться к системе авторизации."
                );

            error.kind =
                "server";

            error.code =
                "NETWORK_ERROR";

            throw error;
        }

        var raw = "";

        try {
            raw =
                await response.text();
        } catch (readError) {
            console.error(
                "[BR AdminTools] Не удалось прочитать ответ сервера:",
                readError
            );

            var responseError =
                new Error(
                    "Ошибка сервера: не удалось получить ответ."
                );

            responseError.kind =
                "server";

            responseError.code =
                "RESPONSE_READ_ERROR";

            throw responseError;
        }

        var data = null;

        try {
            data =
                raw
                    ? JSON.parse(raw)
                    : null;
        } catch (parseError) {
            console.error(
                "[BR AdminTools] Некорректный ответ сервера:",
                parseError,
                raw
            );

            var invalidResponse =
                new Error(
                    "Ошибка сервера: получен некорректный ответ."
                );

            invalidResponse.kind =
                "server";

            invalidResponse.code =
                "INVALID_RESPONSE";

            throw invalidResponse;
        }

        if (
            !response.ok ||
            !data ||
            data.success === false
        ) {
            var code =
                data &&
                (
                    data.error_code ||
                    data.code ||
                    ""
                );

            var message =
                data &&
                (
                    data.error ||
                    data.message ||
                    ""
                );

            if (
                code ===
                "INVALID_CREDENTIALS"
            ) {
                var credentialsError =
                    new Error(
                        "Неверный логин или пароль."
                    );

                credentialsError.kind =
                    "credentials";

                credentialsError.code =
                    code;

                throw credentialsError;
            }

            if (
                code ===
                "ACCOUNT_INACTIVE"
            ) {
                var inactiveError =
                    new Error(
                        "Аккаунт не активирован."
                    );

                inactiveError.kind =
                    "account";

                inactiveError.code =
                    code;

                throw inactiveError;
            }

            if (
                code ===
                "ACCOUNT_BLOCKED"
            ) {
                var blockedError =
                    new Error(
                        "Аккаунт заблокирован."
                    );

                blockedError.kind =
                    "account";

                blockedError.code =
                    code;

                throw blockedError;
            }

            if (
                code ===
                "DEVICE_MISMATCH"
            ) {
                var deviceError =
                    new Error(
                        "Аккаунт уже привязан к другому устройству."
                    );

                deviceError.kind =
                    "account";

                deviceError.code =
                    code;

                throw deviceError;
            }

            console.error(
                "[BR AdminTools] Ошибка сервера:",
                {
                    status:
                        response.status,
                    code:
                        code,
                    message:
                        message,
                    body:
                        data,
                    raw:
                        raw
                }
            );

            var serverError =
                new Error(
                    message ||
                    "Ошибка сервера."
                );

            serverError.kind =
                "server";

            serverError.code =
                code ||
                "SERVER_ERROR";

            throw serverError;
        }

        return data;
    }

    async function fetchGameServers(token) {
        console.info(
            "[BR AdminTools] Запрос статистики Мурманска через Edge Function."
        );

        return request(
            {
                action:
                    "server_stats"
            },
            token
        );
    }

    window.BR_API = {
        url:
            API_URL,

        deviceId:
            getDeviceId,

        request:
            request,

        login:
            function (
                login,
                password,
                remember
            ) {
                return request({
                    action:
                        "login",

                    login:
                        login,

                    password:
                        password,

                    device_id:
                        getDeviceId(),

                    remember:
                        remember === true
                });
            },

        serverStats:
            function (token) {
                return fetchGameServers(
                    token
                );
            },

        auditLog:
            function (
                token,
                action,
                details,
                page
            ) {
                return request(
                    {
                        action:
                            "audit_log",

                        event_action:
                            action,

                        details:
                            details || "",

                        page:
                            page || ""
                    },
                    token
                );
            },

        auditLogs:
            function (
                token,
                limit
            ) {
                return request(
                    {
                        action:
                            "audit_logs",

                        limit:
                            Number(
                                limit || 200
                            )
                    },
                    token
                );
            }
    };

    console.info(
        "[BR AdminTools] Серверный API подключён:",
        API_URL
    );
})();