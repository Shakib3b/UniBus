// ==========================================
// UniBus - Page Security Guard
// ==========================================

// Supabase project URL
const SUPABASE_URL =
    "https://hkgokigrymuslbbtwfpb.supabase.co";

// Supabase publishable key
// This key is SAFE to use in browser code.
const SUPABASE_ANON_KEY =
    "sb_publishable_BqjPT0XpHgK_44BdZ7K7ag_3hthBXBL";


// Create Supabase connection
const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


// ==========================================
// Protect a page based on its role
// ==========================================

async function protectPage(requiredRole) {

    console.log("Checking page access...");

    console.log("Required role:", requiredRole);


    // --------------------------------------
    // Step 1: Check if someone is logged in
    // --------------------------------------

    const {
        data: { user },
        error
    } = await supabaseClient.auth.getUser();


    if (error || !user) {

        console.log("No logged-in user.");

        // Send them back to login
        window.location.href = "/";

        return;
    }


    console.log("Logged-in user:", user.id);


    // --------------------------------------
    // Step 2: Get their profile
    // --------------------------------------

    const {
        data: profile,
        error: profileError
    } = await supabaseClient
        .from("profiles")
        .select("login_id, full_name, role")
        .eq("id", user.id)
        .single();


    if (profileError || !profile) {

        console.error(
            "Could not find user profile:",
            profileError
        );

        // Something is wrong with the account.
        // Log the user out.
        await supabaseClient.auth.signOut();

        window.location.href = "/";

        return;
    }


    console.log("User profile:", profile);


    // --------------------------------------
    // Step 3: Check the role
    // --------------------------------------

    if (profile.role !== requiredRole) {

        console.log(
            "Access denied.",
            "User role:",
            profile.role,
            "Required role:",
            requiredRole
        );


        // Send the user to their correct page

        if (profile.role === "admin") {

            window.location.href = "/admin/index.html";

            return;
        }


        if (profile.role === "driver") {

            window.location.href = "/driver/index.html";

            return;
        }


        if (profile.role === "user") {

            window.location.href = "/user/index.html";

            return;
        }


        // Unknown role
        await supabaseClient.auth.signOut();

        window.location.href = "/";

        return;
    }


    // --------------------------------------
    // Step 4: Access allowed
    // --------------------------------------

    console.log(
        "Access granted for role:",
        profile.role
    );
}