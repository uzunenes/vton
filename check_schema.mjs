import { fal } from "./src/lib/fal.ts"; // Note: this might not work because of imports

async function test() {
    try {
        const result = await fetch("https://rest.alpha.fal.ai/models/fal-ai/idm-vton/schema", {
            headers: {
                "Authorization": `Key ${process.env.FAL_KEY}`
            }
        });
        const data = await result.json();
        console.log(JSON.stringify(data, null, 2));
    } catch (e) {
        console.error(e);
    }
}
test();
