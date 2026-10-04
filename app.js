// ==========================================
// UniBus - Supabase Configuration
// ==========================================

// Replace these two values with your own
// Supabase project information.

const SUPABASE_URL = "https://hkgokigrymuslbbtwfpb.supabase.co";

const SUPABASE_ANON_KEY = "sb_publishable_BqjPT0XpHgK_44BdZ7K7ag_3hthBXBL";


// Create connection with Supabase
const supabaseClient = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


// ==========================================
// Login
// ==========================================

const loginForm = document.getElementById("loginForm");

const message = document.getElementById("message");


loginForm.addEventListener("submit", async function (event) {

    // Stop the browser from refreshing the page
    event.preventDefault();

    // Get values from the input fields
    const userId = document.getElementById("userId").value.trim();

    const password = document.getElementById("password").value;


    // Convert ID into our fake email
    //
    // Example:
    // admin
    //
    // becomes:
    // admin@busportal.app

    const email = `${userId}@busportal.app`;


    message.textContent = "Logging in...";


    // Ask Supabase to log the user in
    const { data, error } = await supabaseClient.auth.signInWithPassword({

        email: email,

        password: password

    });


    // Something went wrong
    if (error) {

        console.error(error);

        message.textContent = error.message;

        return;
    }


    // Login successful
    console.log("Logged in user:", data.user);

    message.textContent = "Login successful!";

});