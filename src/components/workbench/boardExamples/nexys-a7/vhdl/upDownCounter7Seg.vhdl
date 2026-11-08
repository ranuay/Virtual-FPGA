library ieee;
use ieee.std_logic_1164.all;

-- Press BTNC to count up and BTND to count down; BTNU resets the count.
-- The count (0..9) wraps and is shown on digit 0; the other digits stay dark.
-- CLOCK_500Hz is provided by HDLBoard, not by the physical board: on hardware
-- this design needs a clock divider instead.
entity upDownCounter7Seg is
    port (
        CLOCK_500Hz : in  std_logic;
        BTNC        : in  std_logic;
        BTND        : in  std_logic;
        BTNU        : in  std_logic;
        CA, CB, CC, CD, CE, CF, CG : out std_logic;
        DP          : out std_logic;
        AN          : out std_logic_vector(7 downto 0)
    );
end entity;

architecture rtl of upDownCounter7Seg is

    -- Segment bits are gfedcba; a zero lights a segment.
    function to_segments(digit : integer range 0 to 9) return std_logic_vector is
    begin
        case digit is
            when 0 => return "1000000";
            when 1 => return "1111001";
            when 2 => return "0100100";
            when 3 => return "0110000";
            when 4 => return "0011001";
            when 5 => return "0010010";
            when 6 => return "0000010";
            when 7 => return "1111000";
            when 8 => return "0000000";
            when 9 => return "0010000";
        end case;
    end function;

    signal digit    : integer range 0 to 9 := 0;
    -- The buttons as they were on the previous clock edge: a press is the
    -- edge where a button goes from released ('0') to pressed ('1').
    signal btn_prev : std_logic_vector(1 downto 0) := "00";
    signal segments : std_logic_vector(6 downto 0);

begin

    process (CLOCK_500Hz)
    begin
        if rising_edge(CLOCK_500Hz) then
            btn_prev <= BTNC & BTND;

            if BTNU = '1' then
                digit <= 0;
            elsif btn_prev(1) = '0' and BTNC = '1' then      -- BTNC: count up
                -- Tested before adding: 9 + 1 leaves the subtype's range.
                if digit = 9 then
                    digit <= 0;
                else
                    digit <= digit + 1;
                end if;
            elsif btn_prev(0) = '0' and BTND = '1' then      -- BTND: count down
                if digit = 0 then
                    digit <= 9;
                else
                    digit <= digit - 1;
                end if;
            end if;
        end if;
    end process;

    segments <= to_segments(digit);
    CA <= segments(0);
    CB <= segments(1);
    CC <= segments(2);
    CD <= segments(3);
    CE <= segments(4);
    CF <= segments(5);
    CG <= segments(6);
    DP <= '1';                       -- Decimal point off (active low).
    AN <= "11111110";                -- Digit 0 only; the rest stay dark.
end architecture;
