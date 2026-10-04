// ==========================================
// UniBus - Supabase Configuration
// ==========================================

const SUPABASE_URL = "https://hkgokigrymuslbbtwfpb.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_BqjPT0XpHgK_44BdZ7K7ag_3hthBXBL";


// Create a connection to Supabase
const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


// ==========================================
// Login Form
// ==========================================

const loginForm = document.getElementById("loginForm");

const message = document.getElementById("message");


loginForm.addEventListener("submit", async function (event) {

    // Stop the browser from refreshing
    event.preventDefault();


    // Get the values entered by the user
    const userId = document.getElementById("userId").value.trim();

    const password = document.getElementById("password").value;


    // Make sure the user entered both fields
    if (!userId || !password) {

        message.textContent = "Please enter your ID and password.";

        return;
    }


    // Convert the ID into our fake email
    //
    // Example:
    //
    // admin
    //
    // becomes:
    //
    // admin@busportal.app

    const email = `${userId}@busportal.app`;


    message.textContent = "Logging in...";


    // ==========================================
    // Step 1: Login with Supabase Auth
    // ==========================================

    const { data, error } =
        await supabaseClient.auth.signInWithPassword({

            email: email,

            password: password

        });


    // Login failed
    if (error) {

        console.error("Login error:", error);

        message.textContent = error.message;

        return;
    }


    console.log("Authentication successful.");

    console.log("User:", data.user);


    // ==========================================
    // Step 2: Get the user's profile
    // ==========================================

    const { data: profile, error: profileError } =
        await supabaseClient
            .from("profiles")
            .select("login_id, full_name, role")
            .eq("id", data.user.id)
            .single();


    // Profile could not be found
    if (profileError) {

        console.error("Profile error:", profileError);

        message.textContent =
            "Login worked, but your UniBus profile was not found.";

        // Sign the user out because we don't know their role
        await supabaseClient.auth.signOut();

        return;
    }


    console.log("Profile:", profile);


    // ==========================================
    // Step 3: Check the user's role
    // ==========================================

    if (profile.role === "admin") {

        message.textContent = "Welcome, Admin!";

        window.location.href = "/admin/index.html";

        return;
    }


    if (profile.role === "driver") {

        message.textContent = "Welcome, Driver!";

        window.location.href = "/driver/index.html";

        return;
    }


    if (profile.role === "user") {

        message.textContent = "Welcome!";

        window.location.href = "/user/index.html";

        return;
    }


    // ==========================================
    // Unknown role
    // ==========================================

    console.error("Unknown role:", profile.role);

    message.textContent =
        "Your account has an invalid UniBus role.";

    await supabaseClient.auth.signOut();

});