const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {

    // ==========================================
    // 1. POST only
    // ==========================================

    if (event.httpMethod !== "POST") {
        return {
            statusCode: 405,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                error: "Method not allowed"
            })
        };
    }

    try {

        // ==========================================
        // 2. Supabase configuration
        // ==========================================

        const supabaseUrl =
            "https://hkgokigrymuslbbtwfpb.supabase.co";

        const serviceRoleKey =
            process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!serviceRoleKey) {
            return {
                statusCode: 500,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    error:
                        "SUPABASE_SERVICE_ROLE_KEY is missing"
                })
            };
        }


        // ==========================================
        // 3. Get admin access token
        // ==========================================

        const authHeader =
            event.headers?.authorization ||
            event.headers?.Authorization;

        if (
            !authHeader ||
            !authHeader.startsWith("Bearer ")
        ) {
            return {
                statusCode: 401,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    error:
                        "Missing authorization token"
                })
            };
        }

        const accessToken =
            authHeader
                .substring("Bearer ".length)
                .trim();


        // ==========================================
        // 4. Supabase admin client
        // ==========================================

        const supabaseAdmin =
            createClient(
                supabaseUrl,
                serviceRoleKey,
                {
                    auth: {
                        autoRefreshToken: false,
                        persistSession: false
                    }
                }
            );


        // ==========================================
        // 5. Verify logged-in user
        // ==========================================

        const {
            data: userData,
            error: userError
        } =
            await supabaseAdmin.auth.getUser(
                accessToken
            );

        if (
            userError ||
            !userData?.user
        ) {
            return {
                statusCode: 401,
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    error:
                        "Invalid authentication token"
                })
            };
        }

        const adminUser =
            userData.user;


        // ==========================================
        // 6. Verify admin role
        // ==========================================

        const {
            data: adminProfile,
            error: adminProfileError
        } =
            await supabaseAdmin
                .from("profiles")
                .select("id, role")
                .eq("id", adminUser.id)
                .single();

        if (
            adminProfileError ||
            !adminProfile ||
            adminProfile.role !== "admin"
        ) {
            return {
                statusCode: 403,
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    error:
                        "Only admins can create drivers"
                })
            };
        }


        // ==========================================
        // 7. Parse request body
        // ==========================================

        let body;

        try {
            body =
                JSON.parse(
                    event.body || "{}"
                );
        } catch {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    error:
                        "Invalid JSON body"
                })
            };
        }


        // ==========================================
        // 8. Driver information
        // ==========================================

        const full_name =
            String(
                body.full_name || ""
            ).trim();

        const email =
            String(
                body.email || ""
            )
                .trim()
                .toLowerCase();

        const password =
            String(
                body.password || ""
            );

        const phone =
            String(
                body.phone || ""
            ).trim();

        const license_number =
            String(
                body.license_number || ""
            ).trim();

        const bus_id =
            body.bus_id || null;


        // ==========================================
        // 9. Validate fields
        // ==========================================

        if (
            !full_name ||
            !email ||
            !password
        ) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    error:
                        "Full name, email and password are required"
                })
            };
        }

        if (password.length < 6) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    error:
                        "Password must be at least 6 characters"
                })
            };
        }


        // ==========================================
        // 10. Validate email
        // ==========================================

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    error:
                        "Invalid email address"
                })
            };
        }


        // ==========================================
        // 11. Generate login ID
        // ==========================================

        /*
            Example:

            driver01@busportal.app
                    ↓
            login_id = driver01
        */

        const login_id =
            email
                .split("@")[0]
                .trim();

        if (!login_id) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    error:
                        "Could not determine login ID"
                })
            };
        }


        // ==========================================
        // 12. Check duplicate login ID
        // ==========================================

        const {
            data: existingLogin,
            error: existingLoginError
        } =
            await supabaseAdmin
                .from("profiles")
                .select("id")
                .eq(
                    "login_id",
                    login_id
                )
                .maybeSingle();

        if (existingLoginError) {
            return {
                statusCode: 500,
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    error:
                        "Could not check existing login ID",
                    details:
                        existingLoginError.message
                })
            };
        }

        if (existingLogin) {
            return {
                statusCode: 409,
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    error:
                        `Login ID "${login_id}" is already in use`
                })
            };
        }


        // ==========================================
        // 13. Validate selected bus
        // ==========================================

        if (bus_id) {

            const {
                data: bus,
                error: busError
            } =
                await supabaseAdmin
                    .from("buses")
                    .select(
                        "id, bus_number, is_active"
                    )
                    .eq(
                        "id",
                        bus_id
                    )
                    .single();

            if (
                busError ||
                !bus
            ) {
                return {
                    statusCode: 400,
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        error:
                            "Selected bus does not exist"
                    })
                };
            }

            if (!bus.is_active) {
                return {
                    statusCode: 400,
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body: JSON.stringify({
                        error:
                            "Selected bus is inactive"
                    })
                };
            }
        }


        // ==========================================
        // 14. Create Supabase Auth user
        // ==========================================

        const {
            data: authData,
            error: authError
        } =
            await supabaseAdmin
                .auth
                .admin
                .createUser({
                    email: email,
                    password: password,
                    email_confirm: true
                });

        if (
            authError ||
            !authData?.user
        ) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    error:
                        authError?.message ||
                        "Failed to create authentication user"
                })
            };
        }

        const driverId =
            authData.user.id;


        // ==========================================
        // 15. Create profile
        // ==========================================

        const {
            error: profileError
        } =
            await supabaseAdmin
                .from("profiles")
                .insert({
                    id: driverId,
                    login_id: login_id,
                    full_name: full_name,
                    role: "driver"
                });

        if (profileError) {

            // Remove Auth user if profile fails
            await supabaseAdmin
                .auth
                .admin
                .deleteUser(
                    driverId
                );

            return {
                statusCode: 500,
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    error:
                        "Failed to create driver profile",
                    details:
                        profileError.message
                })
            };
        }


        // ==========================================
        // 16. Create drivers record
        // ==========================================

        /*
            IMPORTANT:

            The drivers table DOES NOT have email.

            Email is stored in Supabase Auth.
        */

        const {
            data: driver,
            error: driverError
        } =
            await supabaseAdmin
                .from("drivers")
                .insert({
                    id: driverId,
                    full_name: full_name,
                    phone:
                        phone || null,
                    license_number:
                        license_number || null,
                    bus_id:
                        bus_id || null,
                    is_active: true
                })
                .select()
                .single();

        if (driverError) {

            // Rollback profile
            await supabaseAdmin
                .from("profiles")
                .delete()
                .eq(
                    "id",
                    driverId
                );

            // Rollback Auth user
            await supabaseAdmin
                .auth
                .admin
                .deleteUser(
                    driverId
                );

            return {
                statusCode: 500,
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body: JSON.stringify({
                    error:
                        "Failed to create driver record",
                    details:
                        driverError.message
                })
            };
        }


        // ==========================================
        // 17. Success
        // ==========================================

        return {
            statusCode: 201,
            headers: {
                "Content-Type":
                    "application/json"
            },
            body: JSON.stringify({

                success: true,

                message:
                    "Driver created successfully",

                driver: {
                    id:
                        driver.id,

                    login_id:
                        login_id,

                    full_name:
                        driver.full_name,

                    email:
                        email,

                    phone:
                        driver.phone,

                    license_number:
                        driver.license_number,

                    bus_id:
                        driver.bus_id,

                    is_active:
                        driver.is_active
                }
            })
        };


    } catch (error) {

        console.error(
            "Create driver error:",
            error
        );

        return {
            statusCode: 500,
            headers: {
                "Content-Type":
                    "application/json"
            },
            body: JSON.stringify({
                error:
                    "Internal server error",
                details:
                    error.message
            })
        };
    }
};