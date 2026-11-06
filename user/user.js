
document.addEventListener("DOMContentLoaded", async () => {

    // Protect the student dashboard
    await protectPage("user");

    // Get the currently logged-in account
    const {
        data: { user },
        error: userError
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
        return;
    }

    // Load the student's profile
    const {
        data: profile,
        error: profileError
    } = await supabaseClient
        .from("profiles")
        .select("full_name, login_id, role")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
        console.error("Could not load student profile:", profileError);
        return;
    }

    // Display profile information
    const name = profile.full_name || profile.login_id || "Student";

    document.getElementById("studentName").textContent = name;
    document.getElementById("welcomeName").textContent = name;
    document.getElementById("profileName").textContent = name;
    document.getElementById("loginId").textContent = profile.login_id || "Not available";

    console.log("Student dashboard loaded successfully.");

    // Logout
    document.getElementById("logoutBtn").addEventListener("click", async () => {

        const { error } = await supabaseClient.auth.signOut();

        if (error) {
            alert("Could not log out. Please try again.");
            console.error(error);
            return;
        }

        window.location.href = "/";
    });

});
