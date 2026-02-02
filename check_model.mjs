async function check() {
    const response = await fetch("https://rest.alpha.fal.ai/models/fal-ai/idm-vton", {
        headers: {
            "Authorization": `Key ${process.env.FAL_KEY}`
        }
    });
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
}
check();
