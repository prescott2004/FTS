export const f_of_t = (t, funcType) => {
    switch (funcType) {
        case 1: // Gaussian
            return Math.exp(-0.5 * (t / 1.5) ** 2);
        case 2: // Step (rect)
            return (Math.abs(t) <= 2.0) ? 1 : 0;
        case 3: // Triangle
            {
                const a = 3.0; // 幅
                return Math.max(0, 1 - Math.abs(t) / a); t;
            }
        case 4: // Sine
            return Math.sin(2 * Math.PI * t / 4);
        case 5: // Sawtooth (odd symmetry)
            {
                let T = 4.0;
                let xx = ((t % T) + T) % T; // [0,T)
                return (2 * xx / T - 1);
            }
        case 6: // Custom expression in terms of x
            return Math.cos(2 * Math.PI * t / 4) + Math.sin(t);

        default:
            return 0;
    }
}

