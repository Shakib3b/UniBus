const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event) => {
    // Only allow POST requests
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
        // -----------------------------------------
        // 1. Check environment variables
        // -----------------------------------------

        const supabaseUrl = "https://hkgokigrymuslbbtwfpb.supabase.co";
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            return {
                statusCode: 500,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    error: "Supabase environment variables are missing"
                })
            };
        }

        // -----------------------------------------
        // 2. Get admin access token
        // -----------------------------------------

        const authHeader =
            event.headers.authorization ||
            event.headers.Authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return {
                statusCode: 401,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    error: "Missing authorization token"
                })
            };
        }

        const accessToken = authHeader.replace("Bearer ", "");

        // -----------------------------------------
        // 3. Create Supabase admin client
        // -----------------------------------------

        const supabaseAdmin = createClient(
            supabaseUrl,
            serviceRoleKey,
            {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false
                }
            }
        );

        // -----------------------------------------
        // 4. Verify logged-in user
        // -----------------------------------------

        const {
            data: { user },
            error: userError
        } = await supabaseAdmin.auth.getUser(accessToken);

        if (userError || !user) {
            return {
                statusCode: 401,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    error: "Invalid authentication token"
                })
            };
        }

        // -----------------------------------------
        // 5. Check that caller is an admin
        // -----------------------------------------

        const {
            data: adminProfile,
            error: profileError
        } = await supabaseAdmin
            .from("profiles")
            .select("id, role")
            .eq("id", user.id)
            .single();

        if (
            profileError ||
            !adminProfile ||
            adminProfile.role !== "admin"
        ) {
            return {
                statusCode: 403,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    error: "Only admins can create drivers"
                })
            };
        }

        // -----------------------------------------
        // 6. Read request body
        // -----------------------------------------

        let body;

        try {
            body = JSON.parse(event.body || "{}");
        } catch (error) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    error: "Invalid JSON body"
                })
            };
        }

        const {
            full_name,
            email,
            password,
            phone,
            license_number,
            bus_id
        } = body;

        // -----------------------------------------
        // 7. Validate required fields
        // -----------------------------------------

        if (!full_name || !email || !password) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    error: "Full name, email and password are required"
                })
            };
        }

        if (password.length < 6) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    error: "Password must be at least 6 characters"
                })
            };
        }

        // -----------------------------------------
        // 8. Validate email
        // -----------------------------------------

        const emailRegex =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    error: "Invalid email address"
                })
            };
        }

        // -----------------------------------------
        // 9. Validate selected bus
        // -----------------------------------------

        if (bus_id) {
            const {
                data: bus,
                error: busError
            } = await supabaseAdmin
                .from("buses")
                .select("id, bus_number, is_active")
                .eq("id", bus_id)
                .single();

            if (busError || !bus) {
                return {
                    statusCode: 400,
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        error: "Selected bus does not exist"
                    })
                };
            }

            if (!bus.is_active) {
                return {
                    statusCode: 400,
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        error: "Selected bus is inactive"
                    })
                };
            }
        }

        // -----------------------------------------
        // 10. Create Supabase Auth user
        // -----------------------------------------

        const {
            data: authData,
            error: authError
        } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true
        });

        if (authError) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    error: authError.message
                })
            };
        }

        const driverId = authData.user.id;

        // -----------------------------------------
        // 11. Create driver profile
        // -----------------------------------------

        const {
            error: profileInsertError
        } = await supabaseAdmin
            .from("profiles")
            .insert({
                id: driverId,
                role: "driver"
            });

        if (profileInsertError) {
            await supabaseAdmin.auth.admin.deleteUser(driverId);

            return {
                statusCode: 500,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    error: "Failed to create driver profile",
                    details: profileInsertError.message
                })
            };
        }

        // -----------------------------------------
        // 12. Create driver record
        // -----------------------------------------

        const {
            data: driver,
            error: driverError
        } = await supabaseAdmin
            .from("drivers")
            .insert({
                id: driverId,
                full_name: full_name,
                email: email,
                phone: phone || null,
                license_number: license_number || null,
                bus_id: bus_id || null,
                is_active: true
            })
            .select()
            .single();

        // -----------------------------------------
        // 13. Rollback if driver creation fails
        // -----------------------------------------

        if (driverError) {
            await supabaseAdmin
                .from("profiles")
                .delete()
                .eq("id", driverId);

            await supabaseAdmin.auth.admin.deleteUser(driverId);

            return {
                statusCode: 500,
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    error: "Failed to create driver record",
                    details: driverError.message
                })
            };
        }

        // -----------------------------------------
        // 14. Success
        // -----------------------------------------

        return {
            statusCode: 201,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                success: true,
                message: "Driver created successfully",
                driver: driver
            })
        };

    } catch (error) {
        console.error("Create driver error:", error);

        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                error: "Internal server error",
                details: error.message
            })
        };
    }
};