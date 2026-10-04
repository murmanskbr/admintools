(function () {
    "use strict";

    var API_URL =
        "https://frwajpwzurzokkvhntdl.supabase.co/functions/v1/veb-tools";

    var STATISTICS_URL =
        "https://frwajpwzurzokkvhntdl.supabase.co/functions/v1/statistics";

    var REQUEST_TIMEOUT_MS = 30000;
    var UPLOAD_TIMEOUT_MS = 120000;

    function fetchWithTimeout(
        url,
        options,
        timeoutMs
    ) {
        var controller =
            new AbortController();

        var timeout =
            window.setTimeout(
                function () {
                    controller.abort();
                },
                timeoutMs
            );

        var requestOptions =
            Object.assign(
                {},
                options || {},
                {
                    signal:
                        controller.signal
                }
            );

        return fetch(
            url,
            requestOptions
        ).finally(
            function () {
                window.clearTimeout(
                    timeout
                );
            }
        );
    }

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

    function notifySessionExpired(code) {
        if (
            [
                "SESSION_IDLE_EXPIRED",
                "SESSION_EXPIRED",
                "UNAUTHORIZED"
            ].indexOf(code) === -1
        ) {
            return;
        }

        window.dispatchEvent(
            new CustomEvent(
                "br:session-expired",
                {
                    detail: {
                        code: code
                    }
                }
            )
        );
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

            headers["x-device-id"] =
                getDeviceId();
        }

        var response;

        try {
            response =
                await fetch(
                    API_URL +
                    "?br_ts=" +
                    Date.now(),
                    {
                        method: "POST",
                        headers: headers,
                        body:
                            JSON.stringify(
                                Object.assign(
                                    {},
                                    payload,
                                    {
                                        _client_ts: Date.now(),
                                        _client_request_id:
                                            window.crypto && crypto.randomUUID
                                                ? crypto.randomUUID()
                                                : String(Date.now()) + "-" + Math.random()
                                    }
                                )
                            )
                    }
                );
        } catch (networkError) {
            var timeoutError =
                networkError &&
                networkError.name ===
                    "AbortError";

            console.error(
                "[BR AdminTools] Ошибка запроса:",
                {
                    url: API_URL,
                    action: payload && payload.action,
                    timeout: timeoutError,
                    error: networkError
                }
            );

            var error =
                new Error(
                    timeoutError
                        ? "Сервер не ответил за отведённое время."
                        : "Не удалось подключиться к серверу."
                );

            error.kind =
                "server";

            error.code =
                timeoutError
                    ? "REQUEST_TIMEOUT"
                    : "NETWORK_ERROR";

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

            notifySessionExpired(code);

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

            serverError.status =
                response.status;

            serverError.details =
                data &&
                data.details
                    ? data.details
                    : null;

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

    async function requestStatistics(
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

            headers["x-device-id"] =
                getDeviceId();
        }

        var response;

        try {
            response = await fetchWithTimeout(
                STATISTICS_URL +
                    "?br_ts=" +
                    Date.now(),
                {
                    method: "POST",
                    headers: headers,
                    body:
                        JSON.stringify(
                            Object.assign(
                                {},
                                payload,
                                {
                                    _client_ts: Date.now(),
                                    _client_request_id:
                                        window.crypto && crypto.randomUUID
                                            ? crypto.randomUUID()
                                            : String(Date.now()) + "-" + Math.random()
                                }
                            )
                        )
                },
                REQUEST_TIMEOUT_MS
            );
        } catch (networkError) {
            var timeoutError =
                networkError &&
                networkError.name ===
                    "AbortError";

            console.error(
                "[BR AdminTools] Ошибка подключения Statistics:",
                {
                    action:
                        payload &&
                        payload.action,
                    timeout:
                        timeoutError,
                    error:
                        networkError
                }
            );

            var error =
                new Error(
                    timeoutError
                        ? "Модуль статистики не ответил вовремя."
                        : "Не удалось подключиться к модулю статистики."
                );

            error.kind =
                "server";

            error.code =
                timeoutError
                    ? "STATISTICS_TIMEOUT"
                    : "STATISTICS_NETWORK_ERROR";

            throw error;
        }

        var raw;

        try {
            raw = await response.text();
        } catch (readError) {
            console.error(
                "[BR AdminTools] Не удалось прочитать ответ Statistics:",
                readError
            );

            var readResponseError =
                new Error(
                    "Модуль статистики не вернул тело ответа."
                );

            readResponseError.kind =
                "server";

            readResponseError.code =
                "STATISTICS_RESPONSE_READ_ERROR";

            throw readResponseError;
        }
        var data = null;

        try {
            data = raw
                ? JSON.parse(raw)
                : null;
        } catch (parseError) {
            var invalidResponse =
                new Error(
                    "Модуль статистики вернул некорректный ответ."
                );

            invalidResponse.kind =
                "server";

            invalidResponse.code =
                "STATISTICS_INVALID_RESPONSE";

            throw invalidResponse;
        }

        if (
            !response.ok ||
            !data ||
            data.success === false
        ) {
            var message =
                data &&
                (
                    data.message ||
                    data.error ||
                    ""
                );

            var code =
                data &&
                (
                    data.code ||
                    data.error_code ||
                    ""
                );

            console.error(
                "[BR AdminTools] Ошибка модуля Statistics:",
                {
                    status:
                        response.status,
                    action:
                        payload &&
                        payload.action,
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

            notifySessionExpired(code);

            var error =
                new Error(
                    message ||
                    "Ошибка модуля статистики."
                );

            error.kind =
                "server";

            error.code =
                code ||
                "STATISTICS_ERROR";

            error.status =
                response.status;

            error.details =
                data &&
                data.details
                    ? data.details
                    : null;

            throw error;
        }

        return data;
    }

    async function uploadNormative(
        token,
        files,
        date,
        position,
        comment
    ) {
        var formData = new FormData();

        formData.append("action", "normative_upload");
        formData.append("date", date);
        formData.append("position", position || "");
        formData.append("comment", comment || "");

        var list = Array.from(files || []).filter(function (file) {
            return file instanceof File;
        });

        list.forEach(function (file) {
            formData.append("file", file, file.name);
        });

        var headers = {};

        if (token) {
            headers.Authorization = "Bearer " + token;
            headers["x-device-id"] = getDeviceId();
        }

        var response;

        try {
            response = await fetchWithTimeout(
                API_URL +
                    "?br_ts=" +
                    Date.now(),
                {
                    method: "POST",
                    headers: headers,
                    body: formData
                },
                UPLOAD_TIMEOUT_MS
            );
        } catch (networkError) {
            var timeoutError =
                networkError &&
                networkError.name ===
                    "AbortError";

            console.error(
                "[BR AdminTools] Ошибка загрузки норматива:",
                {
                    timeout:
                        timeoutError,
                    error:
                        networkError
                }
            );

            var error = new Error(
                timeoutError
                    ? "Загрузка норматива превысила допустимое время ожидания."
                    : "Не удалось загрузить норматив."
            );

            error.kind = "server";
            error.code = timeoutError
                ? "NORMATIVE_UPLOAD_TIMEOUT"
                : "NORMATIVE_UPLOAD_NETWORK_ERROR";
            throw error;
        }

        var raw;

        try {
            raw = await response.text();
        } catch (readError) {
            console.error(
                "[BR AdminTools] Не удалось прочитать ответ при загрузке норматива:",
                readError
            );

            var readErrorResult = new Error(
                "Сервер не вернул корректное тело ответа при загрузке норматива."
            );

            readErrorResult.kind = "server";
            readErrorResult.code = "NORMATIVE_UPLOAD_RESPONSE_READ_ERROR";
            throw readErrorResult;
        }
        var data = null;

        try {
            data = raw ? JSON.parse(raw) : null;
        } catch (_) {
            var invalid = new Error("Сервер вернул некорректный ответ при загрузке норматива.");
            invalid.kind = "server";
            invalid.code = "NORMATIVE_UPLOAD_INVALID_RESPONSE";
            throw invalid;
        }

        if (!response.ok || !data || data.success === false) {
            var message = data && (data.message || data.error || "");
            var code = data && (data.code || data.error_code || "");

            console.error(
                "[BR AdminTools] Ошибка загрузки норматива:",
                {
                    status: response.status,
                    code: code,
                    message: message,
                    body: data,
                    raw: raw
                }
            );

            notifySessionExpired(code);

            var uploadError = new Error(message || "Не удалось загрузить норматив.");
            uploadError.kind = "server";
            uploadError.code = code || "NORMATIVE_UPLOAD_ERROR";
            uploadError.status = response.status;
            uploadError.details = data && data.details ? data.details : null;
            throw uploadError;
        }

        return data;
    }

    window.BR_API = {
        url:
            API_URL,

        statisticsUrl:
            STATISTICS_URL,

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

        me:
            function (token) {
                return request(
                    {
                        action:
                            "me"
                    },
                    token
                );
            },

        settingsGet:
            function (token) {
                return request(
                    {
                        action: "settings_get"
                    },
                    token
                );
            },

        settingsUpdate:
            function (token, payload) {
                return request(
                    {
                        action: "settings_update",
                        ...payload
                    },
                    token
                );
            },

        accessCandidates:
            function (token) {
                return request(
                    {
                        action: "access_candidates"
                    },
                    token
                );
            },

        accessList:
            function (token) {
                return request(
                    {
                        action: "access_list"
                    },
                    token
                );
            },

        accessGrant:
            function (token, payload) {
                return request(
                    Object.assign(
                        {
                            action: "access_grant"
                        },
                        payload || {}
                    ),
                    token
                );
            },

        accessManage:
            function (token, payload) {
                return request(
                    Object.assign(
                        {
                            action: "access_manage"
                        },
                        payload || {}
                    ),
                    token
                );
            },

        adminsGoogleList:
            function (token) {
                return requestStatistics(
                    {
                        action:
                            "admins_google_list"
                    },
                    token
                );
            },

        myStatistics:
            function (token) {
                return requestStatistics(
                    {
                        action:
                            "my_statistics"
                    },
                    token
                );
            },

        allStatistics:
            function (
                token,
                date
            ) {
                return requestStatistics(
                    {
                        action:
                            "all_statistics",
                        date:
                            String(date || "").trim(),
                        selected_date:
                            String(date || "").trim()
                    },
                    token
                );
            },

        getStatisticsAdmin:
            function (
                token,
                nickname
            ) {
                return requestStatistics(
                    {
                        action:
                            "get_admin",
                        nickname:
                            nickname
                    },
                    token
                );
            },

        getStatisticsRow:
            function (
                token,
                rowNumber,
                sheetName
            ) {
                return requestStatistics(
                    {
                        action:
                            "get_row",
                        row_number:
                            Number(rowNumber),
                        sheet_name:
                            sheetName || ""
                    },
                    token
                );
            },

        updateStatisticsAdmin:
            function (
                token,
                nickname,
                changes,
                sheetName
            ) {
                return requestStatistics(
                    {
                        action:
                            "update_admin",
                        nickname:
                            nickname,
                        changes:
                            changes,
                        sheet_name:
                            sheetName || ""
                    },
                    token
                );
            },

        updateStatisticsRow:
            function (
                token,
                rowNumber,
                changes,
                sheetName
            ) {
                return requestStatistics(
                    {
                        action:
                            "update_row",
                        row_number:
                            Number(rowNumber),
                        changes:
                            changes,
                        sheet_name:
                            sheetName || ""
                    },
                    token
                );
            },

        appendStatisticsAdmin:
            function (
                token,
                values,
                sheetName
            ) {
                return requestStatistics(
                    {
                        action:
                            "append_admin",
                        values:
                            values,
                        sheet_name:
                            sheetName || ""
                    },
                    token
                );
            },

        updateAdminStatistics:
            function (
                token,
                nickname,
                changes
            ) {
                return requestStatistics(
                    {
                        action:
                            "update_admin",
                        nickname:
                            nickname,
                        changes:
                            changes
                    },
                    token
                );
            },

        statisticsRow:
            function (
                token,
                rowNumber
            ) {
                return requestStatistics(
                    {
                        action:
                            "get_row",
                        row_number:
                            Number(rowNumber)
                    },
                    token
                );
            },

        normativeUpload:
            function (
                token,
                files,
                date,
                position,
                comment
            ) {
                return uploadNormative(
                    token,
                    files,
                    date,
                    position,
                    comment
                );
            },

        notificationsList:
            function (token) {
                return request(
                    {
                        action: "notifications_list"
                    },
                    token
                );
            },

        notificationCreate:
            function (
                token,
                title,
                body,
                targetRole,
                expiresAt
            ) {
                return request(
                    {
                        action: "notification_create",
                        title: title,
                        body: body,
                        target_role: targetRole || "all",
                        expires_at: expiresAt || ""
                    },
                    token
                );
            },

        notificationRead:
            function (
                token,
                notificationId
            ) {
                return request(
                    {
                        action: "notification_read",
                        notification_id: Number(notificationId)
                    },
                    token
                );
            },

        notificationDelete:
            function (
                token,
                notificationId
            ) {
                return request(
                    {
                        action: "notification_delete",
                        notification_id: Number(notificationId)
                    },
                    token
                );
            },

        normativesMine:
            function (
                token
            ) {
                return request(
                    {
                        action:
                            "normatives_mine"
                    },
                    token
                );
            },

        normativesDaily:
            function (
                token,
                date
            ) {
                return requestStatistics(
                    {
                        action:
                            "normatives_daily",
                        date:
                            date
                    },
                    token
                );
            },

        normativesDailyLocal:
            function (
                token,
                date
            ) {
                return request(
                    {
                        action:
                            "normatives_daily",
                        date:
                            date
                    },
                    token
                );
            },

        normativeDetail:
            function (
                token,
                submissionId,
                adminId,
                date
            ) {
                return request(
                    {
                        action:
                            "normative_detail",
                        submission_id:
                            Number(submissionId || 0),
                        admin_id:
                            Number(adminId || 0),
                        date:
                            date || ""
                    },
                    token
                );
            },

        normativeReview:
            function (
                token,
                submissionId,
                adminId,
                date,
                status,
                reviewComment
            ) {
                return request(
                    {
                        action:
                            "normative_review",
                        submission_id:
                            Number(submissionId || 0),
                        admin_id:
                            Number(adminId || 0),
                        date:
                            date || "",
                        status:
                            status,
                        review_comment:
                            reviewComment || ""
                    },
                    token
                );
            },
        normativeMark:
            function (
                token,
                nickname,
                date,
                status,
                reviewComment
            ) {
                return requestStatistics(
                    {
                        action: "normative_mark",
                        nickname: nickname || "",
                        date: date || "",
                        selected_date: date || "",
                        status: status,
                        review_comment: reviewComment || ""
                    },
                    token
                );
            },

        normativesList:
            function (
                token,
                scope
            ) {
                return request(
                    {
                        action:
                            scope ===
                            "all"
                                ? "normatives_all"
                                : "normatives_list"
                    },
                    token
                );
            },

        normativeUrl:
            function (
                token,
                id
            ) {
                return request(
                    {
                        action:
                            "normative_url",
                        id:
                            Number(id)
                    },
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