from services.prompt_assembler import assemble_prompt, build_workflow, ASPECT_RATIOS


def test_assemble_prompt_combines_all_parts():
    prompt = assemble_prompt(
        subject='a woman in rain',
        style='cinematic',
        shot={'camera': 'Sony A7 IV', 'lens': '35mm f/1.4', 'lighting': 'Chiaroscuro', 'ratio': '16:9'},
    )
    assert 'a woman in rain' in prompt
    assert 'cinematic' in prompt.lower() or 'high contrast' in prompt.lower()
    assert 'Sony A7 IV' in prompt
    assert '35mm f/1.4' in prompt
    assert 'Chiaroscuro' in prompt


def test_assemble_prompt_handles_empty_style_and_shot():
    prompt = assemble_prompt(
        subject='mountain peak',
        style='',
        shot={'camera': '', 'lens': '', 'lighting': '', 'ratio': '1:1'},
    )
    assert prompt == 'mountain peak'


def test_build_workflow_injects_prompt_and_seed():
    workflow = build_workflow('a cat in rain', seed=42, ratio='16:9')
    assert workflow['2']['inputs']['text'] == 'a cat in rain'
    assert workflow['5']['inputs']['seed'] == 42


def test_build_workflow_uses_correct_dimensions_for_ratio():
    w16_9 = build_workflow('x', seed=0, ratio='16:9')
    assert w16_9['4']['inputs']['width'] == 1280
    assert w16_9['4']['inputs']['height'] == 720

    w1_1 = build_workflow('x', seed=0, ratio='1:1')
    assert w1_1['4']['inputs']['width'] == 1024
    assert w1_1['4']['inputs']['height'] == 1024
