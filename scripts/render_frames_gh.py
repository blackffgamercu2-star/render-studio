"""GitHub Actions CPU render: frames start..end as JPEG q92.
Args after --: out_dir start end samples"""
import bpy, sys, os
argv = sys.argv[sys.argv.index("--") + 1:]
out, start, end, samples = argv[0], int(argv[1]), int(argv[2]), int(argv[3])
scene = bpy.context.scene
scene.cycles.device = "CPU"
scene.cycles.samples = samples
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 1080, 1920
scene.render.image_settings.file_format = "JPEG"
scene.render.image_settings.quality = 92
os.makedirs(out, exist_ok=True)
scene.render.filepath = os.path.join(out, "frame_")
scene.frame_start, scene.frame_end = start, end
bpy.ops.render.render(animation=True)
print("GH_RENDER_DONE", start, end)
