import ExplanationSection from "@/components/sections/Explanation";
import HeroSection from "@/components/sections/HeroSection";
import StripePricingTable from "@/components/subscription/StripePricingTable";
import SubscriptionCardContainer from "@/components/subscription/SubscriptionCardContainer";
import fetchStripeProducts from "@/lib/stripe/fetchStripeProducts";

export default async function Home() {
  const { products } = await fetchStripeProducts();

  return (
    <main className="flex min-h-screen flex-col space-y-10 pb-10 items-center justify-between lg:p-4">
      <HeroSection />

      <ExplanationSection />

<<<<<<< Updated upstream
      {/* ── Floating Status Bar ── */}
      <AnimatePresence>
        {pipeline.state &&
          (pipeline.isRunning || pipeline.isAwaitingApproval) &&
          !showPipeline && (
            <motion.div
              initial={{ y: -100 }}
              animate={{ y: 0 }}
              exit={{ y: -100 }}
              className="fixed top-0 left-0 right-0 z-40 p-4"
            >
              <div className="max-w-md mx-auto">
                <button
                  onClick={() => setShowPipeline(true)}
                  className="w-full"
                >
                  <PipelineStatus
                    state={pipeline.state}
                    progress={pipeline.progress}
                  />
                </button>
              </div>
            </motion.div>
          )}
      </AnimatePresence>

      {/* ── Error Toast ── */}
      <AnimatePresence>
        {errorMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 bg-red-500/90 backdrop-blur-lg rounded-xl shadow-lg max-w-lg"
          >
            <AlertCircle className="w-5 h-5 text-white shrink-0" />
            <span className="text-sm text-white font-medium">
              {errorMessage}
            </span>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-white/60 hover:text-white ml-2"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Navigation ── */}
      <nav className="w-full max-w-7xl px-6 py-6 flex justify-between items-center z-10">
        <button
          onClick={resetAll}
          className="text-2xl font-bold tracking-tighter hover:opacity-70 transition-opacity"
        >
          VTON
        </button>

        {/* Flow breadcrumb */}
        <div className="flex items-center gap-2 text-[11px] font-bold text-white/30 uppercase tracking-widest">
          <span className={flowStep === "upload" ? "text-white" : ""}>
            Upload
          </span>
          <ChevronRight className="w-3 h-3" />
          <span className={flowStep === "camera" ? "text-white" : ""}>
            Capture
          </span>
          <ChevronRight className="w-3 h-3" />
          <span
            className={
              flowStep === "processing" || flowStep === "result"
                ? "text-white"
                : ""
            }
          >
            Result
          </span>
        </div>

        <div className="hidden md:flex items-center gap-3">
          <div className="px-4 py-1.5 apple-surface text-[11px] font-bold tracking-widest uppercase text-white/40">
            A/B Comparison
            {env.useMock && (
              <span className="ml-2 text-yellow-500">(Mock)</span>
            )}
          </div>
        </div>
      </nav>

      {/* ═══════════════════════════════════════════════════ */}
      {/*  STEP 1: GARMENT UPLOAD                           */}
      {/* ═══════════════════════════════════════════════════ */}
      {flowStep === "upload" && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="w-full max-w-7xl px-6 pb-16"
        >
          {/* Hero */}
          <div className="pt-8 pb-10 space-y-4">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[0.95]">
              Pick a Look
              <br />
              <span className="text-gray-600">Try It On.</span>
            </h1>
            <p className="text-lg text-gray-500 max-w-lg font-medium">
              Upload a product photo, select the item, then step in front of the
              camera.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Left: garment panel */}
            <div className="lg:col-span-7 space-y-8">
              {/* Category */}
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold text-white/30 uppercase tracking-widest">
                  I want to try on
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.value}
                      onClick={() => setCategory(cat.value)}
                      className={clsx(
                        "px-4 py-2 text-xs font-bold rounded-full border transition-all flex items-center gap-1.5",
                        category === cat.value
                          ? "bg-white text-black border-white"
                          : "text-gray-500 border-white/10 hover:border-white/30",
                      )}
                    >
                      <span>{cat.emoji}</span>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Upload area */}
              <div
                className={clsx(
                  "relative aspect-[3/4] rounded-3xl overflow-hidden border transition-all cursor-pointer group",
                  garmentPreview
                    ? "border-white/10"
                    : "border-dashed border-white/10 hover:border-white/30 bg-[#0a0a0a]",
                )}
                onClick={() =>
                  !garmentPreview && garmentInputRef.current?.click()
                }
              >
                <input
                  ref={garmentInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleGarmentSelect}
                  className="hidden"
                />

                {garmentPreview ? (
                  <div className="relative w-full h-full">
                    <img
                      src={garmentPreview}
                      alt="Garment"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                    {/* Skeleton overlay */}
                    <canvas
                      ref={garmentCanvasRef}
                      className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-40 mix-blend-screen"
                    />

                    {/* Status */}
                    <div className="absolute bottom-4 left-4">
                      {garmentUploading ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/20 backdrop-blur-lg rounded-full">
                          <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
                          <span className="text-[10px] font-bold text-blue-400">
                            Uploading…
                          </span>
                        </div>
                      ) : garmentUploadedUrl ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 backdrop-blur-lg rounded-full">
                          <Check className="w-3 h-3 text-green-500" />
                          <span className="text-[10px] font-bold text-green-400">
                            Ready
                          </span>
                        </div>
                      ) : null}
                    </div>

                    {/* Replace */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        garmentInputRef.current?.click();
                      }}
                      className="absolute top-4 right-4 p-2 rounded-lg bg-black/50 backdrop-blur-lg text-white/60 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>

                    {/* Focus brackets */}
                    <Brackets />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-12 text-center">
                    <div className="w-20 h-20 rounded-full bg-white/[0.03] flex items-center justify-center mb-6 border border-white/5">
                      <Upload className="w-8 h-8 text-white/20 group-hover:text-white/50 transition-colors" />
                    </div>
                    <p className="text-base font-semibold text-white/30 mb-2">
                      Upload Product Photo
                    </p>
                    <p className="text-xs text-white/10 uppercase tracking-widest">
                      Mannequin or flat-lay — JPG, PNG, WebP
                    </p>
                    <Brackets />
                  </div>
                )}
              </div>
            </div>

            {/* Right: next step card */}
            <div className="lg:col-span-5 space-y-6">
              <div className="sticky top-12 space-y-6">
                {/* Preview card */}
                <div className="aspect-[3/4] rounded-[32px] bg-[#0a0a0a] border border-white/5 overflow-hidden flex flex-col items-center justify-center text-center p-12">
                  <div className="w-20 h-20 rounded-full border border-white/5 flex items-center justify-center mb-6">
                    <Camera className="w-10 h-10 text-white/5" />
                  </div>
                  <p className="text-white/20 font-bold text-xs tracking-widest uppercase mb-2">
                    Next: Camera
                  </p>
                  <p className="text-white/10 text-xs max-w-[220px]">
                    Upload a garment first, then open the camera to try it on
                  </p>
                </div>

                {/* Open camera button */}
                <button
                  onClick={() => setFlowStep("camera")}
                  disabled={!garmentUploadedUrl}
                  className={clsx(
                    "w-full py-5 rounded-2xl font-bold text-base flex items-center justify-center gap-3 transition-all",
                    garmentUploadedUrl
                      ? "bg-white text-black hover:scale-[1.02] active:scale-[0.98]"
                      : "bg-white/10 text-white/30 cursor-not-allowed",
                  )}
                >
                  <Camera className="w-5 h-5" />
                  Open Camera
                </button>

                {/* Info */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-gray-500 mb-0.5">VTON Models</p>
                    <p className="text-white font-medium">FASHN + Leffa</p>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-gray-500 mb-0.5">Video</p>
                    <p className="text-white font-medium">Kling 2.0</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/*  STEP 2: CAMERA CAPTURE                           */}
      {/* ═══════════════════════════════════════════════════ */}
      {flowStep === "camera" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="w-full max-w-7xl px-6 pb-16"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: garment thumbnail + info */}
            <div className="lg:col-span-3 space-y-4">
              {/* Garment thumbnail */}
              {garmentPreview && (
                <div className="aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 relative">
                  <img
                    src={garmentPreview}
                    alt="Garment"
                    className="w-full h-full object-cover"
                  />
                  <canvas
                    ref={garmentCanvasRef}
                    className="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-40 mix-blend-screen"
                  />
                  <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur rounded-lg text-[10px] font-bold text-white uppercase tracking-wider">
                    {CATEGORIES.find((c) => c.value === category)?.emoji}{" "}
                    {category}
                  </div>
                </div>
              )}

              <button
                onClick={() => setFlowStep("upload")}
                className="w-full py-3 text-sm font-medium text-gray-400 border border-white/10 rounded-xl hover:bg-white/5 transition-all flex items-center justify-center gap-2"
              >
                <ChevronRight className="w-4 h-4 rotate-180" />
                Back to Upload
              </button>

              {/* Captured preview + confirm */}
              {userImagePreview && userImageUrl && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-3"
                >
                  <div className="aspect-[3/4] rounded-2xl overflow-hidden border-2 border-green-500/50 relative">
                    <img
                      src={userImagePreview}
                      alt="Your capture"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 left-2 px-2 py-1 bg-green-500/20 backdrop-blur rounded-lg text-[10px] font-bold text-green-400">
                      ✓ Captured
                    </div>
                  </div>

                  <button
                    onClick={confirmCapture}
                    className="w-full py-4 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    <Play className="w-5 h-5" />
                    Confirm & Start Try-On
                  </button>

                  <button
                    onClick={() => {
                      setUserImageUrl(null);
                      setUserImagePreview(null);
                    }}
                    className="w-full py-3 text-sm font-medium text-gray-500 hover:text-white transition-colors"
                  >
                    Retake
                  </button>
                </motion.div>
              )}
            </div>

            {/* Right: camera */}
            <div className="lg:col-span-9">
              <div className="relative aspect-[4/3] lg:aspect-[16/10] rounded-3xl overflow-hidden border border-white/10 bg-black shadow-[0_40px_100px_rgba(0,0,0,0.8)]">
                <CameraView
                  onCapture={(blob) => handleCapture(blob, true)}
                  isProcessing={pipeline.isRunning}
                  garmentBlob={garmentBlob}
                  onGarmentPoseDetected={setGarmentLandmarks}
                />
              </div>

              <p className="text-center text-xs text-white/20 mt-4 max-w-md mx-auto">
                Position yourself to match the garment pose. The camera will
                auto-capture when alignment is locked. You can also click the
                shutter button manually.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════ */}
      {/*  STEP 3 & 4: PROCESSING & RESULT                  */}
      {/* ═══════════════════════════════════════════════════ */}
      {(flowStep === "processing" || flowStep === "result") && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="w-full max-w-7xl px-6 pb-16"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            {/* Left: info + actions */}
            <div className="lg:col-span-5 space-y-6">
              {/* Input thumbnails */}
              <div className="grid grid-cols-2 gap-3">
                {garmentPreview && (
                  <div className="aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 relative">
                    <img
                      src={garmentPreview}
                      alt="Garment"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur rounded-lg text-[9px] font-bold text-white uppercase tracking-wider">
                      {CATEGORIES.find((c) => c.value === category)?.emoji}{" "}
                      {category}
                    </div>
                  </div>
                )}
                {userImagePreview && (
                  <div className="aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 relative">
                    <img
                      src={userImagePreview}
                      alt="You"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 backdrop-blur rounded-lg text-[9px] font-bold text-white uppercase tracking-wider">
                      📸 You
                    </div>
                  </div>
                )}
              </div>

              {/* Pipeline status */}
              {pipeline.state &&
                (pipeline.isRunning || pipeline.isAwaitingApproval) && (
                  <div className="space-y-3">
                    <button
                      onClick={() => setShowPipeline(true)}
                      className="w-full"
                    >
                      <PipelineStatus
                        state={pipeline.state}
                        progress={pipeline.progress}
                      />
                    </button>
                    {pipeline.isAwaitingApproval && (
                      <button
                        onClick={() => setShowPipeline(true)}
                        className="w-full py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-xs font-bold text-yellow-400 hover:bg-yellow-500/20 transition-all"
                      >
                        Review Required — Open Pipeline
                      </button>
                    )}
                  </div>
                )}

              {/* Result actions */}
              {displayUrl && !pipeline.isRunning && (
                <div className="space-y-3">
                  <button
                    onClick={() => saveResult(displayUrl, "image")}
                    disabled={saving}
                    className="w-full py-4 bg-white text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-gray-100 transition-all"
                  >
                    {saving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : saveSuccess ? (
                      <Check className="w-5 h-5 text-green-600" />
                    ) : (
                      <Download className="w-5 h-5" />
                    )}
                    {saveSuccess ? "Saved to Disk!" : "Save Image"}
                  </button>

                  {resultVideo && (
                    <button
                      onClick={() => saveResult(resultVideo, "video")}
                      disabled={saving}
                      className="w-full py-4 bg-white/10 border border-white/10 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-white/20 transition-all"
                    >
                      <Video className="w-5 h-5" />
                      Save Video
                    </button>
                  )}
                </div>
              )}

              {/* Model info */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <p className="text-gray-500 mb-0.5">Primary</p>
                  <p className="text-white font-medium">FASHN</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <p className="text-gray-500 mb-0.5">Secondary</p>
                  <p className="text-white font-medium">Leffa</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                  <p className="text-gray-500 mb-0.5">Video</p>
                  <p className="text-white font-medium">Kling</p>
                </div>
              </div>

              {/* New try-on */}
              <button
                onClick={resetAll}
                className="w-full py-3 text-sm font-medium text-gray-400 border border-white/10 rounded-xl hover:bg-white/5 transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                New Try-On
              </button>
            </div>

            {/* Right: result preview */}
            <div className="lg:col-span-7">
              <div className="sticky top-8">
                <div className="relative aspect-[3/4] bg-[#0a0a0a] rounded-[32px] overflow-hidden border border-white/5 shadow-[0_40px_100px_rgba(0,0,0,0.8)]">
                  {resultVideo ? (
                    <div className="relative w-full h-full">
                      <video
                        src={resultVideo}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <a
                        href={resultVideo}
                        download
                        className="absolute top-4 right-4 w-12 h-12 apple-glass text-white rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                      >
                        <Download className="w-5 h-5" />
                      </a>
                    </div>
                  ) : displayUrl ? (
                    <div className="relative w-full h-full">
                      <img
                        src={displayUrl}
                        alt="VTON Result"
                        className="w-full h-full object-cover"
                      />

                      {/* A/B Variant selector */}
                      {pipeline.vtonResults?.variants &&
                        Object.keys(pipeline.vtonResults.variants).length >
                          1 && (
                          <div className="absolute top-4 left-4 right-4 flex gap-2">
                            {pipeline.vtonResults.variants.fashn && (
                              <button
                                onClick={() => setSelectedVariant("fashn")}
                                className={clsx(
                                  "flex-1 py-2.5 text-xs font-bold rounded-xl transition-all",
                                  selectedVariant === "fashn" ||
                                    (!selectedVariant &&
                                      pipeline.vtonResults.modelUsed ===
                                        "fashn-v1.6")
                                    ? "bg-white text-black shadow-lg"
                                    : "bg-black/60 text-white/70 hover:bg-black/80 backdrop-blur-lg",
                                )}
                              >
                                FASHN v1.6
                                {pipeline.vtonResults.variants.fashn
                                  .processingTime && (
                                  <span className="ml-1 opacity-60">
                                    (
                                    {(
                                      pipeline.vtonResults.variants.fashn
                                        .processingTime / 1000
                                    ).toFixed(1)}
                                    s)
                                  </span>
                                )}
                              </button>
                            )}
                            {pipeline.vtonResults.variants.leffa && (
                              <button
                                onClick={() => setSelectedVariant("leffa")}
                                className={clsx(
                                  "flex-1 py-2.5 text-xs font-bold rounded-xl transition-all",
                                  selectedVariant === "leffa"
                                    ? "bg-white text-black shadow-lg"
                                    : "bg-black/60 text-white/70 hover:bg-black/80 backdrop-blur-lg",
                                )}
                              >
                                Leffa
                                {pipeline.vtonResults.variants.leffa
                                  .processingTime && (
                                  <span className="ml-1 opacity-60">
                                    (
                                    {(
                                      pipeline.vtonResults.variants.leffa
                                        .processingTime / 1000
                                    ).toFixed(1)}
                                    s)
                                  </span>
                                )}
                              </button>
                            )}
                          </div>
                        )}
                    </div>
                  ) : (
                    /* Loading / empty */
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      {pipeline.isRunning ? (
                        <>
                          <div className="relative w-24 h-24 mb-6">
                            <div className="absolute inset-0 border-4 border-white/5 rounded-full" />
                            <motion.div
                              className="absolute inset-0 border-4 border-t-white rounded-full"
                              animate={{ rotate: 360 }}
                              transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: "linear",
                              }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Sparkles className="w-8 h-8 text-white/20" />
                            </div>
                          </div>
                          <p className="text-white/40 font-bold text-xs tracking-widest uppercase">
                            Processing…
                          </p>
                          <p className="text-white/20 text-xs mt-2">
                            {pipeline.currentStepId === "segmentation" &&
                              "Segmenting garment…"}
                            {pipeline.currentStepId === "virtual-tryon" &&
                              "Running virtual try-on…"}
                            {pipeline.currentStepId === "video-generation" &&
                              "Generating runway video…"}
                          </p>
                        </>
                      ) : (
                        <>
                          <div className="w-20 h-20 rounded-full border border-white/5 flex items-center justify-center mb-6">
                            <Sparkles className="w-10 h-10 text-white/5" />
                          </div>
                          <p className="text-white/20 font-bold text-xs tracking-widest uppercase">
                            Output Preview
                          </p>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Footer ── */}
      <footer className="w-full max-w-7xl px-6 py-12 mt-auto border-t border-white/5 flex flex-col md:flex-row justify-between items-start gap-8 text-[13px] text-gray-600 font-medium">
        <div className="flex gap-10 items-center">
          <span className="text-white/80 font-bold tracking-tighter text-base">
            VTON
          </span>
          <span className="text-white/20 text-xs">Virtual Try-On Studio</span>
        </div>
        <div className="flex items-center gap-8">
          <StatusDot
            active={!!garmentUploadedUrl}
            label={garmentUploadedUrl ? "Garment Ready" : "No Garment"}
          />
          <StatusDot
            active={!!userImageUrl}
            label={userImageUrl ? "User Captured" : "No Capture"}
          />
          <StatusDot
            active={pipeline.isRunning}
            pulse={pipeline.isRunning}
            label={
              pipeline.isRunning
                ? "Processing"
                : pipeline.isComplete
                  ? "Done"
                  : "Idle"
            }
          />
        </div>
      </footer>
=======
      {products.length > 0 ? (
        <SubscriptionCardContainer
          products={products}
          salesCall="Save money and time, buy my SaaS app today and you won't regret it!"
        />
      ) : (
        <p>No subscription plans available at the moment.</p>
      )}

      {/*
      This is an example of how to use the StripePricingTable component. Incase you don't want to build your own.
      <StripePricingTable
        pricingTableId="prctbl_1OgCflCLPADkTljcIdzPukni"
        publishableKey="pk_test_51NyS5wCLPADkTljcNsxH5B71sfFMfC1t47MFQv3JAcFWnV0yVBcfV6hvhR18igcbz1Y0IG79EtCA3vXoZ9Vjax6W008Q95NrMj"
      />*/}
>>>>>>> Stashed changes
    </main>
  );
}
