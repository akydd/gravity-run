export default class HomeScene extends Phaser.Scene {
  constructor() {
    super({ key: 'HomeScene' });
  }

  create() {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    // Title
    this.add.text(cx, cy - 80, 'GRAVITY RUN', {
      fontSize: '52px',
      fill: '#ffffff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Subtitle flavour
    this.add.text(cx, cy - 30, 'flip gravity. dodge everything.', {
      fontSize: '16px',
      fill: '#aaaaaa',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    // Press S prompt (blinks)
    const prompt = this.add.text(cx, cy + 40, 'Press S to start', {
      fontSize: '22px',
      fill: '#f0c040',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: prompt,
      alpha: 0,
      duration: 600,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });

    // Controls hint
    this.add.text(cx, cy + 110, 'SPACE  —  flip gravity (when touching a surface)', {
      fontSize: '13px',
      fill: '#666688',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    this.input.keyboard.once('keydown-S', () => {
      this.scene.start('GameScene');
    });
  }
}
