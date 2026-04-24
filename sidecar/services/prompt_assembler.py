ASPECT_RATIOS: dict[str, tuple[int, int]] = {
    '16:9': (1280, 720),
    '4:3': (1024, 768),
    '1:1': (1024, 1024),
    '9:16': (720, 1280),
    '3:2': (1152, 768),
}

DEFAULT_CHECKPOINT = 'zimage.safetensors'

_STYLE_PROMPTS: dict[str, str] = {
    'cinematic': 'cinematic photography, high contrast, film grain, dramatic lighting',
    'studio_portrait': 'studio portrait photography, professional lighting, clean background, sharp focus',
    'photojournalism': 'photojournalism, natural light, candid, documentary style',
    'fashion_editorial': 'fashion editorial photography, bold composition, magazine quality, high fashion',
    'street': 'street photography, urban environment, candid, gritty, authentic',
    'fine_art': 'fine art photography, artistic composition, painterly, gallery quality',
    'commercial': 'commercial photography, bright, clean, professional',
    'documentary': 'documentary photography, raw, authentic, honest, environmental portrait',
}


def assemble_prompt(subject: str, style: str, shot: dict) -> str:
    parts = [subject.strip()]
    # Unknown styles are silently dropped — style options are a fixed closed set defined in the UI
    if style and style in _STYLE_PROMPTS:
        parts.append(_STYLE_PROMPTS[style])
    shot_parts = []
    if shot.get('camera'):
        shot_parts.append(f'shot on {shot["camera"]}')
    if shot.get('lens'):
        shot_parts.append(f'{shot["lens"]} lens')
    if shot.get('lighting'):
        shot_parts.append(f'{shot["lighting"]} lighting')
    if shot_parts:
        parts.append(', '.join(shot_parts))
    return ', '.join(filter(None, parts))


def build_workflow(prompt: str, seed: int, ratio: str, checkpoint: str = DEFAULT_CHECKPOINT) -> dict:
    width, height = ASPECT_RATIOS.get(ratio, (1280, 720))
    return {
        '1': {
            'class_type': 'CheckpointLoaderSimple',
            'inputs': {'ckpt_name': checkpoint},
        },
        '2': {
            'class_type': 'CLIPTextEncode',
            'inputs': {'text': prompt, 'clip': ['1', 1]},
        },
        '3': {
            'class_type': 'CLIPTextEncode',
            'inputs': {'text': '', 'clip': ['1', 1]},
        },
        '4': {
            'class_type': 'EmptyLatentImage',
            'inputs': {'width': width, 'height': height, 'batch_size': 1},
        },
        '5': {
            'class_type': 'KSampler',
            'inputs': {
                'model': ['1', 0],
                'positive': ['2', 0],
                'negative': ['3', 0],
                'latent_image': ['4', 0],
                'seed': seed,
                'steps': 20,
                'cfg': 4.0,
                'sampler_name': 'euler',
                'scheduler': 'normal',
                'denoise': 1.0,
            },
        },
        '6': {
            'class_type': 'VAEDecode',
            'inputs': {'samples': ['5', 0], 'vae': ['1', 2]},
        },
        '7': {
            'class_type': 'SaveImage',
            'inputs': {'images': ['6', 0], 'filename_prefix': 'localforge'},
        },
    }
