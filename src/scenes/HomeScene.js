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

    // Tap to start button (mobile)
    const btnPad = { x: 90, y: 22 };
    const btnBg = this.add.rectangle(cx, cy + 40, btnPad.x * 2, btnPad.y * 2, 0xf0c040)
      .setInteractive({ useHandCursor: true });
    this.add.text(cx, cy + 40, 'TAP TO START', {
      fontSize: '18px',
      fill: '#000000',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Controls hint
    this.add.text(cx, cy + 110, 'SPACE  —  flip gravity (when touching a surface)', {
      fontSize: '13px',
      fill: '#666688',
      fontFamily: 'monospace',
    }).setOrigin(0.5);

    btnBg.on('pointerdown', () => this.scene.start('GameScene'));
  }
}
