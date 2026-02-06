
import { createPipeline } from './src/lib/pipeline/PipelineOrchestrator';
import { createStepExecutors } from './src/lib/pipeline/steps';

async function testPipeline() {
    console.log('--- Pipeline Mock Test Başlatılıyor ---');

    // Create pipeline with default config (useMock: true)
    const pipeline = createPipeline({
        useMock: true,
        enableVideo: true,
    });

    // Register executors
    const executors = createStepExecutors();
    Object.entries(executors).forEach(([id, executor]) => {
        pipeline.registerStepExecutor(id, executor as any);
    });

    // Listen to events
    pipeline.on('step_started', (event) => {
        console.log(`[EVENT] Adım Başladı: ${event.stepId}`);
    });

    pipeline.on('step_completed', (event) => {
        const data = event.data as any;
        console.log(`[EVENT] Adım Tamamlandı: ${event.stepId}`);
        console.log(`        Süre: ${data.processingTimeMs}ms`);
        console.log(`        Model: ${data.modelUsed}`);
        if (data.outputUrls && data.outputUrls.length > 0) {
            console.log(`        Çıktı Görüntüsü: ${data.outputUrls[0]}`);
        }
    });

    pipeline.on('awaiting_approval', (event) => {
        console.log(`[EVENT] Onay Bekleniyor: ${event.stepId}`);
        // Auto-approve for test
        setTimeout(() => {
            pipeline.approveStep({ approved: true });
        }, 100);
    });

    pipeline.on('pipeline_completed', () => {
        console.log('\n--- Pipeline Başarıyla Tamamlandı! ---');
        console.log('Test özeti: Tüm adımlar MOCK verisiyle çalıştı ve fal.ai çağrısı yapılmadı.');
    });

    pipeline.on('pipeline_failed', (event) => {
        console.error(`[EVENT] Pipeline HATASI: ${event.stepId}`, event.data);
    });

    // Start the pipeline
    const inputs = {
        userImageUrl: 'https://example.com/user.jpg',
        garmentImageUrl: 'https://example.com/garment.jpg',
        garmentCategory: 'tops' as any,
    };

    try {
        await pipeline.start(inputs);
    } catch (error) {
        console.error('Pipeline başlatma hatası:', error);
    }
}

testPipeline();
