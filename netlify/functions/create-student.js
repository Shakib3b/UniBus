const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;


exports.handler = async function (event) {
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
    };

    // Handle preflight requests
    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 204,
            headers,
            body: ""
        };
    }

    // Allow POST only
    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({
                error: "Method not allowed."
            })
        };
    }

    try {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
            return { statusCode: 500, headers, body: JSON.stringify({ error: "Supabase server configuration is missing." }) };
        }
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
        // Check service role key
        if (!SUPABASE_SERVICE_ROLE_KEY) {
            throw new Error(
                "SUPABASE_SERVICE_ROLE_KEY is missing in Netlify environment variables."
            );
        }

        // Get authorization token
        const authorization =
            event.headers.authorization ||
            event.headers.Authorization ||
            "";

        if (!authorization.startsWith("Bearer ")) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    error: "Authentication required."
                })
            };
        }

        const accessToken = authorization.slice(7);

        // Verify logged-in user
        const {
            data: callerData,
            error: callerError
        } = await supabaseAdmin.auth.getUser(accessToken);

        if (callerError || !callerData.user) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    error: "Invalid or expired session."
                })
            };
        }

        // Check whether the caller is an admin
        const {
            data: callerProfile,
            error: profileLookupError
        } = await supabaseAdmin
            .from("profiles")
            .select("role")
            .eq("id", callerData.user.id)
            .single();

        if (
            profileLookupError ||
            !callerProfile ||
            callerProfile.role !== "admin"
        ) {
            return {
                statusCode: 403,
                headers,
                body: JSON.stringify({
                    error: "Only administrators can create student accounts."
                })
            };
        }

        // Read request body
        let body;

        try {
            body = JSON.parse(event.body || "{}");
        } catch {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: "Invalid JSON body."
                })
            };
        }

        const fullName = String(body.full_name || "").trim();
        const loginId = String(body.login_id || "").trim().toLowerCase();
        const password = String(body.password || "");

        // Validate required fields
        if (!fullName || !loginId || !password) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: "Full name, login ID and password are required."
                })
            };
        }

        // Validate login ID
        if (!/^[a-z0-9._-]{3,30}$/.test(loginId)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: "Login ID must be 3–30 characters and use only letters, numbers, dots, underscores or hyphens."
                })
            };
        }

        // Validate password
        if (password.length < 6) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: "Password must be at least 6 characters."
                })
            };
        }

        // Generate internal email for Supabase Auth
        const email = `${loginId}@busportal.app`;

        // Check whether login ID already exists
        const {
            data: existingProfile,
            error: existingProfileError
        } = await supabaseAdmin
            .from("profiles")
            .select("id")
            .eq("login_id", loginId)
            .maybeSingle();

        if (existingProfileError) {
            throw existingProfileError;
        }

        if (existingProfile) {
            return {
                statusCode: 409,
                headers,
                body: JSON.stringify({
                    error: "This student login ID is already in use."
                })
            };
        }

        // Create Supabase Auth account
        const {
            data: createdAuth,
            error: createAuthError
        } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName,
                login_id: loginId,
                role: "user"
            }
        });

        if (createAuthError) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: createAuthError.message
                })
            };
        }

        const authUserId = createdAuth.user.id;

        // Create matching profile in profiles table
        const {
            error: insertProfileError
        } = await supabaseAdmin
            .from("profiles")
            .insert({
                id: authUserId,
                login_id: loginId,
                full_name: fullName,
                role: "user"
            });

        // Delete Auth account if profile creation fails
        if (insertProfileError) {
            await supabaseAdmin.auth.admin.deleteUser(authUserId);
            throw insertProfileError;
        }

        // Return success response
        return {
            statusCode: 201,
            headers,
            body: JSON.stringify({
                message: "Student account created successfully.",
                student: {
                    id: authUserId,
                    full_name: fullName,
                    login_id: loginId,
                    role: "user"
                }
            })
        };

    } catch (error) {
        console.error("Create student error:", error);

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: error.message || "Internal server error."
            })
        };
    }
};